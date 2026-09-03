import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/server";
import { rotuloTipoServico } from "@/lib/servico-estado";

// =============================================================================
// PDF DO FECHO DE SERVIÇO — um único documento por Serviço, sempre gravado no
// mesmo caminho "{organization_id}/{service_id}/fecho.pdf" (bucket "fechos",
// upload com upsert — nunca "v1"/"v2"). Chamado a seguir a cada um dos 4
// pontos do ciclo em que a "informação oficial" do fecho muda (ver os 4
// pontos de chamada: app/tecnico/actions.ts, app/admin/servicos/actions.ts,
// app/admin/faturacao/actions.ts) — nunca por edições operacionais
// irrelevantes (notas, reagendamento antes de iniciar, etc.).
//
// Corre sempre com createAdminClient() (privilégio de serviço), nunca com a
// sessão de quem chamou — é o que permite ao Financeiro consultar o PDF
// (via policy de leitura no bucket "fechos") sem nunca precisar de SELECT em
// visits/visit_materials_used/visit_photos (tabelas privadas do Técnico).
// Toda a query aqui filtra organization_id manualmente, como em qualquer
// outro uso de createAdminClient() nesta app.
//
// Nunca lança exceção — devolve sempre {ok, error?}, para nunca bloquear a
// operação principal (validar/rejeitar/faturar) que o chama a seguir. Em
// caso de erro, fica só um console.error (sem tabela/coluna nova para o
// registar) — ver nota no relatório final sobre esta limitação conhecida.
// =============================================================================

const BUCKET = "fechos";
const LARGURA_PAGINA = 595.28;
const ALTURA_PAGINA = 841.89;
const MARGEM = 50;
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2;

const COR_TITULO = rgb(0.13, 0.16, 0.22);
const COR_TEXTO = rgb(0.2, 0.22, 0.26);
const COR_LEVE = rgb(0.4, 0.44, 0.5);
const COR_MARCA = rgb(0.976, 0.451, 0.086);
const COR_LINHA = rgb(0.85, 0.87, 0.9);
const COR_FUNDO_SECAO = rgb(0.95, 0.96, 0.98);

type Cursor = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
};

function novaPagina(cursor: Cursor) {
  cursor.page = cursor.pdf.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
  cursor.y = ALTURA_PAGINA - MARGEM;
}

// Garante que há espaço para a próxima linha/bloco — só isto, sem qualquer
// helper genérico de layout (não vale a pena para um único documento).
function garantirEspaco(cursor: Cursor, altura: number) {
  if (cursor.y - altura < MARGEM) novaPagina(cursor);
}

function secao(cursor: Cursor, titulo: string) {
  garantirEspaco(cursor, 34);
  cursor.y -= 8;
  cursor.page.drawRectangle({ x: MARGEM, y: cursor.y - 4, width: LARGURA_UTIL, height: 18, color: COR_FUNDO_SECAO });
  cursor.page.drawText(titulo.toUpperCase(), { x: MARGEM + 6, y: cursor.y, size: 9, font: cursor.fontBold, color: COR_TITULO });
  cursor.y -= 22;
}

function texto(cursor: Cursor, conteudo: string, opts: { size?: number; bold?: boolean; cor?: any; indent?: number } = {}) {
  const size = opts.size ?? 10;
  const font = opts.bold ? cursor.fontBold : cursor.fontRegular;
  const cor = opts.cor ?? COR_TEXTO;
  const x = MARGEM + (opts.indent ?? 0);
  const larguraDisponivel = LARGURA_UTIL - (opts.indent ?? 0);
  const maxCharsPorLinha = Math.max(20, Math.floor((larguraDisponivel / size) * 2.1));

  const paragrafos = conteudo.split("\n");
  for (const paragrafo of paragrafos) {
    const palavras = paragrafo.split(" ");
    let linhaAtual = "";
    const linhas: string[] = [];
    for (const palavra of palavras) {
      const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
      if (tentativa.length > maxCharsPorLinha && linhaAtual) {
        linhas.push(linhaAtual);
        linhaAtual = palavra;
      } else {
        linhaAtual = tentativa;
      }
    }
    if (linhaAtual || linhas.length === 0) linhas.push(linhaAtual);

    for (const linha of linhas) {
      garantirEspaco(cursor, size + 6);
      cursor.page.drawText(linha, { x, y: cursor.y, size, font, color: cor });
      cursor.y -= size + 6;
    }
  }
}

function linhaSeparadora(cursor: Cursor) {
  garantirEspaco(cursor, 14);
  cursor.y -= 4;
  cursor.page.drawLine({ start: { x: MARGEM, y: cursor.y }, end: { x: MARGEM + LARGURA_UTIL, y: cursor.y }, thickness: 0.5, color: COR_LINHA });
  cursor.y -= 10;
}

const FORMATOS_EMBUTIVEIS = new Set(["jpg", "jpeg", "png"]);

function extensaoDe(path: string): string {
  return (path.split(".").pop() || "").toLowerCase();
}

const EVENTO_LABEL: Record<string, string> = {
  criado: "Criado",
  agendado: "Agendado",
  reagendado: "Reagendado",
  iniciado: "Iniciado",
  concluido: "Concluído",
  nova_visita: "Nova visita",
  nao_realizado: "Não realizado",
  correcao_pedida: "Correção pedida",
  corrigido: "Reaberto após correção",
  validado: "Validado",
  faturado: "Faturado",
  cancelado: "Cancelado",
  reativado: "Reativado",
  liquidado: "Liquidado",
};

const RESULTADO_VISITA_LABEL: Record<string, string> = {
  concluido: "Concluído",
  nova_visita: "Ficou pendente de nova visita",
  nao_realizado: "Não foi possível realizar",
};

export async function gerarPdfFecho(serviceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient();

    // Auditoria de segurança (Ponto 2) — esta é a ÚNICA query desta função
    // sem filtro explícito de organization_id, e propositadamente: ainda não
    // o conhecemos, é este pedido que o revela. É por isso o verdadeiro
    // ponto de confiança de toda a função — createAdminClient() ignora RLS
    // por completo, por isso `serviceId` tem de já vir verificado por quem
    // chama (nunca um valor solto vindo diretamente de um formulário/input
    // do cliente sem antes passar por uma RPC/policy que confirme o dono).
    // Confirmado nos 4 pontos de chamada: as 3 RPCs finance_* (validar/
    // rejeitar/faturar) já verificam organization_id = my_org() por dentro e
    // lançam exceção antes de a Server Action chegar a chamar esta função;
    // app/tecnico/actions.ts (concluirVisita) deriva o service_id sempre a
    // partir da própria visita fechada, com a sessão do técnico (RLS
    // "technician selects own service visits"), nunca do valor solto
    // submetido pelo cliente. Todas as queries a seguir a esta já filtram
    // organization_id explicitamente, nunca confiando na RLS (que aqui está
    // sempre bypassada pelo admin client).
    const { data: servico, error: servicoError } = await supabase
      .from("services")
      .select(
        `id, codigo, organization_id, tipo, descricao, notas, estado, faturacao_estado,
         faturacao_data, faturacao_valor, faturacao_referencia, faturacao_metodo_pagamento, faturacao_liquidado_data,
         data_agendada, hora_agendada, hora_fim_agendada,
         valor, client_id, address_id, request_id, budget_id,
         clients(nome, nif, telefone, email),
         client_addresses(label, endereco),
         service_technicians(profiles(nome))`
      )
      .eq("id", serviceId)
      .single();
    if (servicoError || !servico) return { ok: false, error: `Serviço não encontrado (${serviceId}): ${servicoError?.message ?? "sem dados"}` };

    const organizationId = servico.organization_id as string;

    const [{ data: org }, { data: request }, { data: budget }, { data: visitaPreviaSibling }, { data: visits }, { data: eventos }, { data: validacoes }] =
      await Promise.all([
        supabase.from("organizations").select("nome, nif").eq("id", organizationId).single(),
        servico.request_id
          ? supabase.from("requests").select("codigo, tipo, descricao, origem").eq("id", servico.request_id).eq("organization_id", organizationId).maybeSingle()
          : Promise.resolve({ data: null as any }),
        servico.budget_id
          ? supabase
              .from("budgets")
              .select("numero, estado, iva_percent, budget_items(tipo, descricao, qtd, valor_unit)")
              .eq("id", servico.budget_id)
              .eq("organization_id", organizationId)
              .maybeSingle()
          : Promise.resolve({ data: null as any }),
        // Visita Prévia irmã do mesmo Orçamento (se existir) — só uma menção
        // leve de rastreabilidade, nunca duplica o detalhe dela aqui.
        servico.budget_id
          ? supabase
              .from("services")
              .select("codigo, estado, data_agendada")
              .eq("budget_id", servico.budget_id)
              .neq("id", serviceId)
              .eq("organization_id", organizationId)
              .maybeSingle()
          : Promise.resolve({ data: null as any }),
        supabase
          .from("visits")
          .select(
            `id, data, hora_inicio_real, hora_fim_real, trabalho_realizado, resultado, mao_obra_tipo, mao_obra_detalhe,
             problema_identificado, equipamento_instalado, quantidade_instalada, testes_realizados, valor_calculado, created_at,
             visit_materials_used(nome, qtd, preco_unit), visit_photos(storage_path)`
          )
          .eq("service_id", serviceId)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true }),
        supabase
          .from("service_events")
          .select("tipo, descricao, created_at")
          .eq("service_id", serviceId)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true }),
        supabase
          .from("service_validations")
          .select("acao, motivo, created_at")
          .eq("service_id", serviceId)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true }),
      ]);

    const todasVisitas = visits ?? [];
    // A visita "atual" — a última que fechou como concluído. Se por algum
    // motivo ainda não houver nenhuma (chamada precoce), usa a última visita
    // que existir, para o documento nunca ficar vazio.
    const visitasConcluidas = todasVisitas.filter((v: any) => v.resultado === "concluido");
    const visitaAtual = visitasConcluidas[visitasConcluidas.length - 1] ?? todasVisitas[todasVisitas.length - 1] ?? null;

    // Materiais/referências — só da visita "atual" (a que efetivamente conta
    // para a faturação); nunca soma às visitas anteriores já superadas por
    // uma correção. Ponto 7: nome exatamente como o Técnico escreveu, nunca
    // um "matching" aproximado — só marca referência quando há EXATAMENTE
    // uma correspondência inequívoca por descrição igual no catálogo.
    const materiais = (visitaAtual?.visit_materials_used ?? []) as { nome: string; qtd: number; preco_unit: number }[];
    const nomesMateriais = Array.from(new Set(materiais.map((m) => m.nome)));
    const referenciaPorNome = new Map<string, string | null>();
    if (nomesMateriais.length > 0) {
      const { data: catalogo } = await supabase
        .from("catalog_items")
        .select("referencia, descricao")
        .eq("organization_id", organizationId)
        .in("descricao", nomesMateriais);
      const contagem = new Map<string, number>();
      for (const c of catalogo ?? []) contagem.set(c.descricao, (contagem.get(c.descricao) ?? 0) + 1);
      for (const c of catalogo ?? []) {
        if ((contagem.get(c.descricao) ?? 0) === 1) referenciaPorNome.set(c.descricao, c.referencia);
      }
    }

    // Fotografias — de todas as visitas (transparência total), separadas em
    // embutíveis (jpeg/png) e não-embutíveis (webp/heic/heif ou outro
    // formato) — ponto 6: nunca perder a informação de que existem, mesmo
    // quando não podem ser desenhadas no PDF.
    const fotosEmbutiveis: { storage_path: string; data: string }[] = [];
    const fotosNaoEmbutiveis: { storage_path: string; data: string }[] = [];
    for (const v of todasVisitas) {
      for (const foto of v.visit_photos ?? []) {
        const alvo = FORMATOS_EMBUTIVEIS.has(extensaoDe(foto.storage_path)) ? fotosEmbutiveis : fotosNaoEmbutiveis;
        alvo.push({ storage_path: foto.storage_path, data: v.data });
      }
    }

    // ---------------------------------------------------------------------
    // Montagem do documento
    // ---------------------------------------------------------------------
    const pdf = await PDFDocument.create();
    const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const cursor: Cursor = { pdf, page: pdf.addPage([LARGURA_PAGINA, ALTURA_PAGINA]), y: ALTURA_PAGINA - MARGEM, fontRegular, fontBold };

    // Identificação
    cursor.page.drawRectangle({ x: MARGEM, y: cursor.y - 24, width: 32, height: 32, color: COR_MARCA });
    cursor.page.drawText("nX", { x: MARGEM + 6, y: cursor.y - 15, size: 14, font: fontBold, color: rgb(1, 1, 1) });
    cursor.page.drawText(org?.nome ?? "—", { x: MARGEM + 42, y: cursor.y - 6, size: 14, font: fontBold, color: COR_TITULO });
    if (org?.nif) cursor.page.drawText(`NIF: ${org.nif}`, { x: MARGEM + 42, y: cursor.y - 22, size: 9, font: fontRegular, color: COR_LEVE });
    cursor.y -= 55;

    texto(cursor, `FECHO DE SERVIÇO — ${servico.codigo}`, { size: 16, bold: true });
    texto(
      cursor,
      `Gerado em ${new Date().toLocaleString("pt-PT")} · Estado atual: ${servico.estado}${
        servico.faturacao_estado === "faturado" ? " · Faturado" : servico.faturacao_estado === "liquidado" ? " · Liquidado" : ""
      }`,
      { size: 9, cor: COR_LEVE }
    );

    // Pedido / origem
    secao(cursor, "Pedido / Origem");
    if (request) {
      texto(cursor, `Pedido ${request.codigo} · Tipo: ${request.tipo} · Origem: ${request.origem}`);
      texto(cursor, request.descricao, { cor: COR_LEVE });
    } else {
      texto(cursor, "Sem Pedido de origem associado.", { cor: COR_LEVE });
    }

    // Cliente / NIF / local
    secao(cursor, "Cliente / Local");
    texto(cursor, (servico as any).clients?.nome ?? "—", { bold: true });
    if ((servico as any).clients?.nif) texto(cursor, `NIF: ${(servico as any).clients.nif}`, { cor: COR_LEVE });
    if ((servico as any).clients?.telefone) texto(cursor, `Telefone: ${(servico as any).clients.telefone}`, { cor: COR_LEVE });
    if ((servico as any).client_addresses) {
      texto(cursor, `${(servico as any).client_addresses.label}: ${(servico as any).client_addresses.endereco}`, { cor: COR_LEVE });
    }
    texto(cursor, `${rotuloTipoServico(servico.tipo)} · ${servico.descricao}`);

    // Orçamento / visita prévia
    secao(cursor, "Orçamento / Visita Prévia");
    if (budget) {
      const itens = budget.budget_items ?? [];
      const subtotal = itens.reduce((acc: number, i: any) => acc + Number(i.qtd) * Number(i.valor_unit), 0);
      const total = subtotal * (1 + Number(budget.iva_percent) / 100);
      texto(cursor, `Orçamento nº ${budget.numero} · Estado: ${budget.estado} · Total: ${total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}`);
    } else {
      texto(cursor, "Sem Orçamento associado.", { cor: COR_LEVE });
    }
    if (visitaPreviaSibling) {
      texto(cursor, `Visita Prévia realizada: ${visitaPreviaSibling.codigo} (${visitaPreviaSibling.estado}${visitaPreviaSibling.data_agendada ? `, ${visitaPreviaSibling.data_agendada}` : ""}).`, {
        cor: COR_LEVE,
      });
    }

    // Técnico e datas
    secao(cursor, "Técnico e Datas");
    const tecnicos = ((servico as any).service_technicians ?? []).map((t: any) => t.profiles?.nome).filter(Boolean);
    texto(cursor, tecnicos.length > 0 ? `Técnico(s): ${tecnicos.join(", ")}` : "Sem técnico atribuído.");
    texto(cursor, `Agendado para: ${servico.data_agendada ?? "—"} ${servico.hora_agendada?.slice(0, 5) ?? ""}${servico.hora_fim_agendada ? `–${servico.hora_fim_agendada.slice(0, 5)}` : ""}`, { cor: COR_LEVE });
    if (visitaAtual) {
      texto(cursor, `Visita atual (a que conta para este fecho): ${visitaAtual.data}, das ${visitaAtual.hora_inicio_real?.slice(0, 5) ?? "—"} às ${visitaAtual.hora_fim_real?.slice(0, 5) ?? "—"}.`, {
        cor: COR_LEVE,
      });
    }
    // Ponto 3 — substituir o PDF nunca apaga o histórico: quando há mais do
    // que uma visita (ex: 1ª visita devolvida para correção, 2ª visita já
    // aceite), lista todas aqui, pela ordem em que aconteceram, para o
    // ciclo "fecho → devolvido → novo fecho" ficar sempre visível de
    // relance — nunca só implícito no histórico de eventos mais abaixo.
    if (todasVisitas.length > 1) {
      texto(cursor, "Histórico de visitas:", { bold: true, size: 9 });
      todasVisitas.forEach((v: any, i: number) => {
        const atual = v.id === visitaAtual?.id ? " — visita atual" : "";
        texto(cursor, `${i + 1}. ${v.data} — ${RESULTADO_VISITA_LABEL[v.resultado] ?? v.resultado ?? "em curso"}${atual}`, { size: 9, cor: COR_LEVE, indent: 6 });
      });
    }

    // Problema identificado
    secao(cursor, "Problema Identificado");
    texto(cursor, visitaAtual?.problema_identificado || "Não aplicável / não registado.");

    // Trabalho realizado
    secao(cursor, "Trabalho Realizado");
    texto(cursor, visitaAtual?.trabalho_realizado || "Não registado.");

    // Resultado / testes
    secao(cursor, "Resultado / Testes");
    texto(cursor, `Resultado da visita: ${RESULTADO_VISITA_LABEL[visitaAtual?.resultado] ?? visitaAtual?.resultado ?? "—"}`);
    if (visitaAtual?.equipamento_instalado) texto(cursor, `Equipamento instalado: ${visitaAtual.equipamento_instalado}${visitaAtual.quantidade_instalada ? ` (qtd: ${visitaAtual.quantidade_instalada})` : ""}`, { cor: COR_LEVE });
    if (visitaAtual?.testes_realizados) texto(cursor, `Testes realizados: ${visitaAtual.testes_realizados}`, { cor: COR_LEVE });

    // Materiais, quantidades e referências
    secao(cursor, "Materiais, Quantidades e Referências");
    if (materiais.length === 0) {
      texto(cursor, "Sem materiais registados nesta visita.", { cor: COR_LEVE });
    } else {
      for (const m of materiais) {
        const referencia = referenciaPorNome.get(m.nome);
        texto(cursor, `• ${m.nome} — Qtd: ${m.qtd} — Referência: ${referencia ?? "Não disponível"}`);
      }
    }

    // Mão de obra
    secao(cursor, "Mão de Obra");
    if (visitaAtual?.mao_obra_tipo) {
      texto(cursor, `Tipo: ${visitaAtual.mao_obra_tipo}${visitaAtual.mao_obra_detalhe ? ` (${visitaAtual.mao_obra_detalhe})` : ""}`);
      if (visitaAtual.valor_calculado != null) {
        texto(cursor, `Valor calculado (materiais + mão de obra): ${Number(visitaAtual.valor_calculado).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}`, { cor: COR_LEVE });
      }
    } else {
      texto(cursor, "Não registada.", { cor: COR_LEVE });
    }

    // Fotografias
    secao(cursor, "Fotografias");
    if (fotosEmbutiveis.length === 0 && fotosNaoEmbutiveis.length === 0) {
      texto(cursor, "Sem fotografias registadas.", { cor: COR_LEVE });
    } else {
      for (const foto of fotosEmbutiveis) {
        try {
          const { data: blob, error: downloadError } = await supabase.storage.from("visitas").download(foto.storage_path);
          if (downloadError || !blob) throw downloadError ?? new Error("sem dados");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const ext = extensaoDe(foto.storage_path);
          const imagem = ext === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const larguraMax = 220;
          const escala = Math.min(1, larguraMax / imagem.width);
          const w = imagem.width * escala;
          const h = imagem.height * escala;
          garantirEspaco(cursor, h + 20);
          cursor.page.drawImage(imagem, { x: MARGEM, y: cursor.y - h, width: w, height: h });
          cursor.page.drawText(`Visita de ${foto.data}`, { x: MARGEM, y: cursor.y - h - 12, size: 8, font: fontRegular, color: COR_LEVE });
          cursor.y -= h + 26;
        } catch (e: any) {
          // Uma foto que falhe a incorporar (ficheiro em falta no Storage,
          // corrompido, etc.) nunca interrompe o resto do documento — só
          // fica de fora, tal como uma não-embutível pelo formato.
          fotosNaoEmbutiveis.push(foto);
        }
      }
      if (fotosNaoEmbutiveis.length > 0) {
        texto(
          cursor,
          `${fotosNaoEmbutiveis.length} fotografia(s) não incorporada(s) neste PDF devido ao formato (ex: HEIC/WebP) ou por não terem sido possíveis de ler — consulta a ficha do Serviço para as ver.`,
          { cor: COR_LEVE }
        );
      }
    }

    // Notas
    secao(cursor, "Notas");
    texto(cursor, servico.notas || "Sem notas.");

    // Histórico do percurso
    secao(cursor, "Histórico do Percurso");
    if ((eventos ?? []).length === 0) {
      texto(cursor, "Sem histórico.", { cor: COR_LEVE });
    } else {
      for (const e of eventos ?? []) {
        texto(cursor, `${new Date(e.created_at).toLocaleString("pt-PT")} — ${EVENTO_LABEL[e.tipo] ?? e.tipo}: ${e.descricao}`, { size: 9 });
      }
    }

    // Estado final / validação / faturação
    secao(cursor, "Estado Final / Validação / Faturação");
    texto(cursor, `Estado do serviço: ${servico.estado}`);
    for (const v of validacoes ?? []) {
      texto(cursor, `${new Date(v.created_at).toLocaleString("pt-PT")} — ${v.acao === "validado" ? "Validado" : "Devolvido para correção"}${v.motivo ? `: ${v.motivo}` : ""}`, { cor: COR_LEVE });
    }
    if (servico.faturacao_estado === "faturado" || servico.faturacao_estado === "liquidado") {
      texto(
        cursor,
        `Faturado em ${servico.faturacao_data ?? "—"} · Referência: ${servico.faturacao_referencia ?? "—"} · Valor: ${
          servico.faturacao_valor != null ? Number(servico.faturacao_valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "—"
        }`
      );
      if (servico.faturacao_estado === "liquidado") {
        texto(
          cursor,
          `Liquidado em ${servico.faturacao_liquidado_data ?? "—"} · Método de pagamento: ${servico.faturacao_metodo_pagamento ?? "—"}`
        );
      } else {
        texto(cursor, "Ainda não liquidado (pagamento por receber).", { cor: COR_LEVE });
      }
    } else {
      texto(cursor, "Ainda não faturado.", { cor: COR_LEVE });
    }
    linhaSeparadora(cursor);

    const bytes = await pdf.save();
    const path = `${organizationId}/${serviceId}/fecho.pdf`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(bytes), {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) return { ok: false, error: `Falha ao gravar PDF em ${path}: ${uploadError.message}` };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// Nunca deve bloquear a operação que a chama (validar/rejeitar/faturar/
// fechar) — chamar sempre "fire and forget" com este wrapper, que só regista
// o erro (console.error, sem tabela nova para o guardar — ver limitação
// conhecida no relatório final) e nunca propaga a exceção.
export async function gerarPdfFechoSemBloquear(serviceId: string, contexto: string) {
  const resultado = await gerarPdfFecho(serviceId);
  if (!resultado.ok) {
    console.error(`[pdf-fecho] Falha ao gerar/atualizar o PDF do fecho (contexto: ${contexto}, serviceId: ${serviceId}):`, resultado.error);
  }
}
