"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nowTimeHHMMSS } from "@/lib/agenda-dates";
import { sugerirMaoObraPorDuracao } from "@/lib/mao-obra";
import { gerarPdfFechoSemBloquear } from "@/lib/pdf-fecho";

// Vai sempre buscar a visita aberta mais recente diretamente à BD — usado
// pelo botão "Terminar serviço" para nunca depender de um valor de
// visitaAbertaId que possa ter ficado desatualizado num render anterior
// (era exatamente isto que fazia o botão "Confirmar" não fazer nada: se o
// id da visita passado por prop estivesse desatualizado/nulo, submeter()
// saía em silêncio sem gravar nem avisar o técnico de nada).
export async function obterVisitaAberta(serviceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id")
    .eq("service_id", serviceId)
    .is("hora_fim_real", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// Chamado por abrirFinalizar() logo a seguir a obterVisitaAberta() — nunca
// confiar no "servico.motivo_correcao" recebido por prop no render inicial
// da página para decidir se esta visita é uma correção: esse valor fica
// preenchido para sempre depois da primeira rejeição de um serviço (nunca
// volta a null), por isso, sozinho, não distingue "esta visita concreta é
// uma reabertura de correção" de "este serviço já foi rejeitado alguma vez
// no passado, mas esta visita é uma reabertura normal, sem correção". A
// única fonte fiável é sempre visits.apos_correcao da própria visita aberta
// (o mesmo valor que tech_finish_visit usa para exigir a justificação) —
// por isso vai sempre buscar isto em tempo real, nunca por prop.
export async function obterContextoCorrecao(visitId: string) {
  const supabase = await createClient();
  const { data: visita } = await supabase.from("visits").select("service_id, apos_correcao").eq("id", visitId).maybeSingle();
  if (!visita?.apos_correcao) return { aposCorrecao: false, visitaAnterior: null };

  const { data: anterior } = await supabase
    .from("visits")
    .select(
      "trabalho_realizado, problema_identificado, equipamento_instalado, quantidade_instalada, testes_realizados, mao_obra_tipo, mao_obra_detalhe, visit_materials_used(nome, qtd, preco_unit), visit_photos(storage_path)"
    )
    .eq("service_id", visita.service_id)
    .neq("id", visitId)
    .not("hora_fim_real", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!anterior) return { aposCorrecao: true, visitaAnterior: null };

  let fotosUrls: string[] = [];
  if (anterior.visit_photos?.length) {
    const paths = anterior.visit_photos.map((p: any) => p.storage_path);
    const { data: assinadas } = await supabase.storage.from("visitas").createSignedUrls(paths, 3600);
    fotosUrls = (assinadas ?? []).map((s: any) => s.signedUrl).filter(Boolean);
  }

  return {
    aposCorrecao: true,
    visitaAnterior: {
      trabalhoRealizado: anterior.trabalho_realizado as string | null,
      problemaIdentificado: anterior.problema_identificado as string | null,
      equipamentoInstalado: anterior.equipamento_instalado as string | null,
      quantidadeInstalada: anterior.quantidade_instalada as number | null,
      testesRealizados: anterior.testes_realizados as string | null,
      maoObraTipo: anterior.mao_obra_tipo as string | null,
      maoObraDetalhe: anterior.mao_obra_detalhe as string | null,
      materiais: (anterior.visit_materials_used ?? []) as { nome: string; qtd: number; preco_unit: number }[],
      fotosUrls,
    },
  };
}

// Onda 2 — sugestão inicial de mão de obra para o formulário de fecho,
// calculada a partir de hora_inicio_real da visita (gravada
// automaticamente por tech_start_service, nunca pedida ao Técnico). Usa o
// mesmo padrão de comparação de colunas `time` já estabelecido em
// lib/operacional.ts (nowTimeHHMMSS() do lado do servidor, comparado como
// texto) — nunca a hora do telemóvel do Técnico, para não desalinhar com o
// fuso horário da própria base de dados.
// É só uma pré-seleção: o Técnico continua sempre livre para escolher outra
// opção, e o valor realmente faturado é sempre recalculado por
// tech_finish_visit a partir da opção que ficar selecionada no momento de
// confirmar — nunca a partir deste cálculo.
export async function sugerirMaoObraDaVisita(visitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("hora_inicio_real")
    .eq("id", visitId)
    .is("hora_fim_real", null)
    .maybeSingle();

  if (!data?.hora_inicio_real) return null;

  const [ih, im] = (data.hora_inicio_real as string).split(":").map(Number);
  const [ah, am] = nowTimeHHMMSS().split(":").map(Number);
  let minutos = ah * 60 + am - (ih * 60 + im);
  if (minutos < 0) minutos += 24 * 60; // visita atravessou a meia-noite
  return sugerirMaoObraPorDuracao(minutos);
}

export async function iniciarServico(serviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tech_start_service", { p_service_id: serviceId });
  if (error) throw new Error(error.message);
  revalidatePath(`/tecnico/servico/${serviceId}`);
  return data as string; // id da visita criada
}

export async function concluirVisita(input: {
  visitId: string;
  serviceId: string;
  resultado: "concluido" | "nova_visita" | "nao_realizado";
  trabalhoRealizado: string;
  materiais: { nome: string; qtd: number; precoUnit?: number }[];
  fotos: string[];
  maoObraTipo?: string | null;
  maoObraDetalhe?: string | null;
  novaDataAgendada?: string | null;
  novaHoraAgendada?: string | null;
  problemaIdentificado?: string | null;
  equipamentoInstalado?: string | null;
  quantidadeInstalada?: number | null;
  testesRealizados?: string | null;
  clientePagou?: boolean | null;
  meioPagamento?: string | null;
  faturaComNif?: boolean | null;
  nif?: string | null;
  justificacaoCorrecao?: string | null;
}) {
  const supabase = await createClient();

  // Materiais chegam de um formulário do técnico como objeto tipado (não
  // FormData), mas continuam a ser input do cliente — qtd/precoUnit
  // negativos alimentariam diretamente visits.valor_calculado e, desde o
  // BLOCO 14, também services.valor. Mesma regra de sinal de criarServico.
  if (input.materiais.some((m) => !Number.isFinite(m.qtd) || m.qtd < 0 || (m.precoUnit != null && (!Number.isFinite(m.precoUnit) || m.precoUnit < 0)))) {
    throw new Error("Quantidade e preço unitário dos materiais têm de ser números iguais ou superiores a 0.");
  }

  const { error } = await supabase.rpc("tech_finish_visit", {
    p_visit_id: input.visitId,
    p_resultado: input.resultado,
    p_trabalho_realizado: input.trabalhoRealizado,
    p_materiais: input.materiais.map((m) => ({ nome: m.nome, qtd: m.qtd, preco_unit: m.precoUnit ?? 0 })),
    p_fotos: input.fotos,
    p_mao_obra_tipo: input.maoObraTipo ?? null,
    p_mao_obra_detalhe: input.maoObraDetalhe ?? null,
    p_nova_data_agendada: input.novaDataAgendada ?? null,
    p_nova_hora_agendada: input.novaHoraAgendada ?? null,
    p_problema_identificado: input.problemaIdentificado ?? null,
    p_equipamento_instalado: input.equipamentoInstalado ?? null,
    p_quantidade_instalada: input.quantidadeInstalada ?? null,
    p_testes_realizados: input.testesRealizados ?? null,
    p_cliente_pagou: input.clientePagou ?? null,
    p_meio_pagamento: input.meioPagamento ?? null,
    p_fatura_com_nif: input.faturaComNif ?? null,
    p_nif: input.nif ?? null,
    p_justificacao_correcao: input.justificacaoCorrecao ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/tecnico/servico/${input.serviceId}`);
  revalidatePath("/tecnico");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/agenda");

  // PDF do Fecho (Ponto 5) — só quando a visita fecha mesmo como "concluido"
  // (nova_visita/nao_realizado não são um fecho real, ver lib/pdf-fecho.ts).
  // Nunca bloqueia o fecho do Técnico: corre depois de a RPC já ter tido
  // sucesso, e falhas ficam só em log (gerarPdfFechoSemBloquear nunca lança).
  //
  // Auditoria de segurança (Ponto 2) — nunca usar input.serviceId
  // diretamente aqui: é um valor submetido pelo cliente que tech_finish_visit
  // nunca valida (a RPC só olha para p_visit_id, deriva o service_id dela
  // própria por dentro). Sem esta verificação, um pedido forjado a esta
  // Server Action (visitId de uma visita própria válida + serviceId de um
  // Serviço de outra organização) faria gerarPdfFecho sobrescrever o
  // fecho.pdf de um Serviço que não é deste técnico. Reconfirma-se sempre o
  // service_id a partir da própria visita, com a sessão do técnico (RLS
  // "technician selects own service visits" só devolve linha se o técnico
  // estiver mesmo atribuído a esse serviço) — nunca com createAdminClient().
  if (input.resultado === "concluido") {
    const { data: visitaFechada } = await supabase.from("visits").select("service_id").eq("id", input.visitId).maybeSingle();
    if (visitaFechada?.service_id) {
      await gerarPdfFechoSemBloquear(visitaFechada.service_id, "tech_finish_visit");
    } else {
      console.error(`[pdf-fecho] Não foi possível confirmar o service_id da visita ${input.visitId} para gerar o PDF do fecho.`);
    }
  }
}
