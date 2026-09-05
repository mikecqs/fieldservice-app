"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import { registarEventoServico } from "@/lib/service-events";
import { registarEventoOrcamento } from "@/lib/budget-events";
import { podeEditarItensOrcamento, podeMarcarEnviado, podeAceitarOrcamento, podeAvancarParaEstado } from "@/lib/orcamento-estado";
import { TIPO_VISITA_ORCAMENTO } from "@/lib/servico-estado";
import { escreverAgendamentoServico } from "@/lib/agendamento-servico";
import { calcularPrecoMaoObra, type PrecosMaoObra } from "@/lib/mao-obra";

export async function criarOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return;

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({ organization_id: organizationId, client_id })
    .select()
    .single();
  if (error || !budget) throw new Error(error?.message || "Não foi possível criar o orçamento.");

  await registarEventoOrcamento(supabase, {
    organizationId,
    budgetId: budget.id,
    tipo: "criado",
    descricao: "Orçamento criado.",
  });

  redirect(`/admin/orcamentos/${budget.id}`);
}

// Onda 3 (Etapa 2) — duplica um orçamento existente como novo rascunho
// independente, para poupar reescrever as mesmas linhas num orçamento
// parecido. O original nunca é alterado (só lido); o novo nasce sempre em
// 'rascunho', sem request_id/service_id/enviado_em/followup_em (nunca
// copiados — um duplicado não é o mesmo orçamento, não pertence ao pedido
// do original, e copiar request_id criaria dois orçamentos para o mesmo
// pedido, que obterDetalhePedido() não espera — usa .maybeSingle() a
// assumir sempre no máximo um por pedido) nem `numero` (sequência própria,
// como qualquer orçamento novo). `client_id` e `iva_percent` são
// referenciados tal como no orçamento original — nunca um novo cliente.
// Mesmo padrão de autorização de criarOrcamento: cliente normal sujeito a
// RLS (policy "admin manages budgets"/"admin manages budget_items"), nunca
// createAdminClient().
export async function duplicarOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: original } = await supabase
    .from("budgets")
    .select("numero, client_id, iva_percent, budget_items(tipo, descricao, qtd, valor_unit)")
    .eq("id", id)
    .single();
  if (!original) throw new Error("Orçamento original não encontrado.");

  const { data: novo, error } = await supabase
    .from("budgets")
    .insert({
      organization_id: organizationId,
      client_id: original.client_id,
      iva_percent: original.iva_percent,
    })
    .select()
    .single();
  if (error || !novo) throw new Error(error?.message || "Não foi possível duplicar o orçamento.");

  const itens = original.budget_items ?? [];
  if (itens.length > 0) {
    const { error: itensError } = await supabase.from("budget_items").insert(
      itens.map((item) => ({
        organization_id: organizationId,
        budget_id: novo.id,
        tipo: item.tipo,
        descricao: item.descricao,
        qtd: item.qtd,
        valor_unit: item.valor_unit,
      }))
    );
    if (itensError) throw new Error(itensError.message);
  }

  await registarEventoOrcamento(supabase, {
    organizationId,
    budgetId: novo.id,
    tipo: "criado",
    descricao: `Duplicado a partir do orçamento #${original.numero}.`,
  });

  revalidatePath("/admin/orcamentos");
  redirect(`/admin/orcamentos/${novo.id}`);
}

type NovoItemOrcamento = { tipo: string; descricao: string; qtd: number; valor_unit: number };

// Onda 3 (Etapa 3) — guard partilhado entre adicionarItem (uma linha) e
// adicionarItensCatalogo (várias de uma vez), para as duas nunca terem
// versões diferentes da mesma regra: quantidade/valor têm de ser >= 0 (BLOCO
// 14/15) e o orçamento só pode ser editado em 'rascunho' (podeEditarItensOrcamento).
async function inserirItensOrcamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  budgetId: string,
  itens: NovoItemOrcamento[]
) {
  for (const item of itens) {
    if (!Number.isFinite(item.qtd) || item.qtd < 0 || !Number.isFinite(item.valor_unit) || item.valor_unit < 0) {
      throw new Error("Quantidade e valor unitário têm de ser números iguais ou superiores a 0.");
    }
  }

  const { data: orcamento } = await supabase.from("budgets").select("estado").eq("id", budgetId).single();
  if (!orcamento || !podeEditarItensOrcamento(orcamento)) {
    throw new Error("Este orçamento já não pode ser editado (só é possível em rascunho).");
  }

  const { error } = await supabase.from("budget_items").insert(
    itens.map((item) => ({
      organization_id: organizationId,
      budget_id: budgetId,
      tipo: item.tipo,
      descricao: item.descricao,
      qtd: item.qtd,
      valor_unit: item.valor_unit,
    }))
  );
  if (error) throw new Error(error.message);
}

export async function adicionarItem(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const budget_id = String(formData.get("budget_id") || "");
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "");
  const qtd = Number(formData.get("qtd") || 1);
  if (!budget_id || !descricao) return;

  // Mão de obra nunca confia no preço vindo do cliente (pode ser alterado
  // via devtools no input escondido) — recalcula sempre no servidor a partir
  // das mesmas taxas configuradas em Configurações/org_settings que o
  // Técnico usa no fecho de OS (lib/mao-obra.ts), pela duração escolhida.
  let valor_unit = Number(formData.get("valor_unit") || 0);
  if (tipo === "mao_obra") {
    const duracao = String(formData.get("duracao_mao_obra") || "");
    const { data: settings } = await supabase
      .from("org_settings")
      .select(
        "valor_mao_obra_primeira_hora, valor_mao_obra_hora_adicional, valor_mao_obra_dia_completo, valor_mao_obra_2_dias, valor_mao_obra_visita_orcamento, valor_mao_obra_taxa_deslocacao"
      )
      .eq("organization_id", organizationId)
      .single();
    const precos: PrecosMaoObra = {
      primeiraHora: settings?.valor_mao_obra_primeira_hora ?? 0,
      horaAdicional: settings?.valor_mao_obra_hora_adicional ?? 0,
      diaCompleto: settings?.valor_mao_obra_dia_completo ?? 0,
      doisDias: settings?.valor_mao_obra_2_dias ?? 0,
      visitaOrcamento: settings?.valor_mao_obra_visita_orcamento ?? 0,
      taxaDeslocacao: settings?.valor_mao_obra_taxa_deslocacao ?? 0,
    };
    valor_unit = calcularPrecoMaoObra(duracao, precos);
  }

  await inserirItensOrcamento(supabase, organizationId, budget_id, [{ tipo, descricao, qtd, valor_unit }]);
  revalidatePath(`/admin/orcamentos/${budget_id}`);
}

// Onda 3 (Etapa 3) — adiciona várias linhas do catálogo de uma só vez, para
// não obrigar a repetir "escolher → Adicionar linha" item a item. Cada linha
// nasce com o mesmo formato já usado ao escolher um único item do catálogo
// no formulário de linha única (tipo 'materiais', qtd 1, valor = preço de
// venda do catálogo) — nunca uma regra de cálculo nova; o utilizador
// continua livre para editar ou remover qualquer uma destas linhas depois,
// exatamente como qualquer outra (removerItem já cobre isso, sem alteração).
export async function adicionarItensCatalogo(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const budget_id = String(formData.get("budget_id") || "");
  const catalogIds = formData.getAll("catalog_item_id").map(String).filter(Boolean);
  if (!budget_id || catalogIds.length === 0) return;

  const { data: catalogo } = await supabase
    .from("catalog_items")
    .select("id, referencia, descricao, preco_venda")
    .in("id", catalogIds);
  if (!catalogo || catalogo.length === 0) return;

  const itens: NovoItemOrcamento[] = catalogo.map((c) => ({
    tipo: "materiais",
    descricao: `${c.referencia} — ${c.descricao}`,
    qtd: 1,
    valor_unit: Number(c.preco_venda),
  }));

  await inserirItensOrcamento(supabase, organizationId, budget_id, itens);
  revalidatePath(`/admin/orcamentos/${budget_id}`);
}

export async function removerItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const budget_id = String(formData.get("budget_id") || "");
  if (!id) return;

  const { data: orcamento } = await supabase.from("budgets").select("estado").eq("id", budget_id).single();
  if (!orcamento || !podeEditarItensOrcamento(orcamento)) {
    throw new Error("Este orçamento já não pode ser editado (só é possível em rascunho).");
  }

  await supabase.from("budget_items").delete().eq("id", id);
  revalidatePath(`/admin/orcamentos/${budget_id}`);
}

// Marcar como enviado avança logo para "aguarda resposta" (o Admin não tem
// de fazer esse segundo clique manual) e agenda automaticamente o
// follow-up para daqui a 7 dias — é isto que a Central de Atenção lê depois
// (ver "Orçamento sem resposta"). O botão só existe na UI enquanto o
// orçamento está em rascunho, mas isso sozinho não impede um pedido direto
// ao servidor — por isso a validação real (podeMarcarEnviado) está aqui,
// não só escondida atrás do botão.
export async function marcarEnviado(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: orcamentoAtual } = await supabase.from("budgets").select("estado").eq("id", id).single();
  if (!orcamentoAtual || !podeMarcarEnviado(orcamentoAtual)) {
    throw new Error("Este orçamento já não pode ser marcado como enviado (só é possível em rascunho).");
  }

  const hoje = new Date();
  const enviado_em = hoje.toISOString().slice(0, 10);
  const followupDate = new Date(hoje);
  followupDate.setDate(followupDate.getDate() + 7);
  const followup_em = followupDate.toISOString().slice(0, 10);

  await supabase
    .from("budgets")
    .update({ estado: "aguarda_resposta", enviado_em, followup_em })
    .eq("id", id);

  await registarEventoOrcamento(supabase, {
    organizationId,
    budgetId: id,
    tipo: "enviado",
    descricao: `Marcado como enviado — follow-up agendado automaticamente para ${followup_em}.`,
  });

  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
  revalidatePath("/admin/dashboard");
}

const AVANCAR_ESTADO_EVENTO: Record<string, "followup" | "recusado" | "cancelado"> = {
  followup: "followup",
  recusado: "recusado",
  cancelado: "cancelado",
};

// Nunca aceita o estado de destino às cegas: podeAvancarParaEstado só
// permite exatamente as transições que a UI já oferecia (cada botão só
// aparecia a partir de estados de origem específicos) — agora validadas
// aqui também, não só pelo botão estar ou não visível.
export async function avancarEstado(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "");
  if (!id || !estado) return;

  const { data: orcamentoAtual } = await supabase.from("budgets").select("estado").eq("id", id).single();
  if (!orcamentoAtual || !podeAvancarParaEstado(orcamentoAtual, estado)) {
    throw new Error(`Não é possível alterar este orçamento para "${estado}" a partir do estado atual.`);
  }

  await supabase.from("budgets").update({ estado }).eq("id", id);

  const tipoEvento = AVANCAR_ESTADO_EVENTO[estado];
  if (tipoEvento) {
    await registarEventoOrcamento(supabase, {
      organizationId,
      budgetId: id,
      tipo: tipoEvento,
      descricao: `Estado alterado para "${estado}".`,
    });
  }

  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
}

// Fluxo B (Visita Prévia a partir de um Orçamento já existente, ANTES da
// aceitação formal) — alternativa a aceitarOrcamento, nunca a substitui:
// "Orçamento aceite → Instalação → Agendamento" continua exatamente como
// estava; isto só acrescenta "Orçamento → Visita Prévia → Agendamento" como
// caminho extra, para quando o cliente concorda com o valor preliminar mas
// ainda falta confirmar cablagens/acessos/medidas no local antes de fechar.
// Mesmo mecanismo de Serviço/Agenda que criarVisitaOrcamentoDePedido
// (app/admin/pedidos/actions.ts) — só a origem muda (Orçamento, não
// Pedido). Liga a visita ao Orçamento via `budget_id` (a mesma coluna que
// aceitarOrcamento já usa, só que no sentido inverso) e, quando existir,
// também ao Pedido via `request_id` — preserva a cadeia Cliente + Morada +
// Orçamento + Visita para análise futura, sem tabela nem coluna nova.
// Bloqueado quando o orçamento já foi decidido (mesma regra de
// aceitarOrcamento) — não faz sentido agendar uma visita para um orçamento
// já aceite, recusado ou cancelado.
export async function agendarVisitaPreviaDoOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: budget } = await supabase
    .from("budgets")
    .select("id, estado, numero, client_id, request_id, requests(address_id, descricao)")
    .eq("id", id)
    .single();
  if (!budget) return;

  if (!podeAceitarOrcamento(budget)) {
    throw new Error("Este orçamento já foi decidido — não é possível agendar uma visita prévia.");
  }

  // Regra: um Orçamento só pode ter uma Visita Prévia através deste fluxo —
  // qualquer que seja o estado dela (por agendar/agendada/em curso/
  // concluída/cancelada). Nunca cria uma segunda automaticamente; se no
  // futuro for preciso repetir a visita, isso é uma ação explícita própria
  // a criar depois, não esta. Encaminha para a visita já existente em vez
  // de bloquear em seco, para o clique (ou um duplo clique/reenvio) nunca
  // ficar sem destino nenhum.
  const { data: visitaExistente } = await supabase
    .from("services")
    .select("id")
    .eq("budget_id", id)
    .eq("tipo", TIPO_VISITA_ORCAMENTO)
    .maybeSingle();
  if (visitaExistente) {
    redirect(`/admin/servicos/${visitaExistente.id}`);
  }

  const addressId = (budget.requests as any)?.address_id as string | undefined;
  const descricaoBase = ((budget.requests as any)?.descricao as string | undefined) || `Orçamento #${budget.numero}`;

  const { data: service, error } = await supabase
    .from("services")
    .insert({
      organization_id: organizationId,
      client_id: budget.client_id,
      address_id: addressId || null,
      request_id: budget.request_id,
      budget_id: budget.id,
      tipo: TIPO_VISITA_ORCAMENTO,
      descricao: `Visita Prévia — ${descricaoBase}`,
    })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar a Visita Prévia.");

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: service.id,
    tipo: "criado",
    descricao: `Visita Prévia agendada a partir do orçamento #${budget.numero} — por agendar na Agenda.`,
  });

  revalidatePath(`/admin/orcamentos/${id}`);
  redirect("/admin/agenda");
}

// Aceitar um orçamento cria o serviço correspondente com o valor TOTAL
// (com IVA incluído) — é esse o valor que fica associado ao serviço e que
// depois flui para a faturação, usando sempre calcularOrcamento() como
// única fonte da conta, para nunca haver dois cálculos diferentes do mesmo
// orçamento.
export async function aceitarOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: budget } = await supabase
    .from("budgets")
    .select("*, budget_items(*), requests(tipo, descricao, client_id, address_id)")
    .eq("id", id)
    .single();
  if (!budget) return;

  // Nunca aceitar duas vezes o mesmo orçamento (criaria um segundo serviço
  // órfão ligado a ele) nem um orçamento já recusado/cancelado.
  if (!podeAceitarOrcamento(budget)) {
    throw new Error("Este orçamento já foi decidido (aceite, recusado ou cancelado) e não pode ser aceite outra vez.");
  }

  // Agendar já na aceitação é opcional — sem estes 3 campos o serviço fica
  // "por_agendar" como sempre (agenda-se depois, na Agenda ou na ficha do
  // Serviço). Validado antes de criar nada, para nunca ficar um serviço
  // criado com um agendamento inválido a meio.
  const data_agendada = String(formData.get("data_agendada") || "") || null;
  const hora_agendada = String(formData.get("hora_agendada") || "") || null;
  const hora_fim_agendada = String(formData.get("hora_fim_agendada") || "") || null;
  const tecnico_id = String(formData.get("tecnico_id") || "") || null;
  if (data_agendada && (!hora_agendada || !hora_fim_agendada)) {
    throw new Error("Hora de início e hora de fim são ambas obrigatórias para agendar.");
  }
  if (hora_agendada && hora_fim_agendada && hora_fim_agendada <= hora_agendada) {
    throw new Error("A hora de término deve ser depois da hora de início.");
  }

  const { total: valor } = calcularOrcamento(budget.budget_items ?? [], budget.iva_percent);

  // Quando o orçamento veio de um pedido, a morada escolhida nesse pedido
  // acompanha o serviço criado agora — revalidada aqui contra o cliente do
  // orçamento, nunca só confiada no que já foi validado na criação do
  // pedido. Um orçamento criado diretamente (sem pedido) não tem morada
  // nenhuma para propagar — address_id fica null, como já acontecia.
  let address_id: string | null = null;
  const pedidoAddressId = budget.requests?.address_id as string | undefined;
  if (pedidoAddressId) {
    const { data: morada } = await supabase
      .from("client_addresses")
      .select("id")
      .eq("id", pedidoAddressId)
      .eq("client_id", budget.client_id)
      .single();
    if (morada) address_id = morada.id;
  }

  const { data: service, error } = await supabase
    .from("services")
    .insert({
      organization_id: organizationId,
      client_id: budget.client_id,
      address_id,
      request_id: budget.request_id,
      budget_id: budget.id,
      tipo: budget.requests?.tipo || "Serviço",
      descricao: budget.requests?.descricao || `Orçamento aceite`,
      valor,
    })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar o serviço.");

  await supabase.from("budgets").update({ estado: "aceite", service_id: service.id }).eq("id", id);
  if (budget.request_id) {
    await supabase.from("requests").update({ estado: "convertido" }).eq("id", budget.request_id);
  }

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: service.id,
    tipo: "criado",
    descricao: "Serviço criado a partir de orçamento aceite.",
  });
  await registarEventoOrcamento(supabase, {
    organizationId,
    budgetId: id,
    tipo: "aceite",
    descricao: "Orçamento aceite — serviço criado.",
  });

  // Reaproveita exatamente a mesma escrita/regra de transição de
  // atualizarAgendamento (ficha do Serviço) e criarOuAgendarNoPopup
  // (Agenda) — nunca uma terceira versão da mesma lógica. Sem data, o
  // serviço fica "por_agendar" (já aparece em "Serviços por agendar" no
  // Dashboard).
  if (data_agendada && hora_agendada && hora_fim_agendada) {
    await escreverAgendamentoServico(supabase, {
      serviceId: service.id,
      dataAgendada: data_agendada,
      horaAgendada: hora_agendada,
      horaFimAgendada: hora_fim_agendada,
    });
    if (tecnico_id) {
      await supabase.from("service_technicians").insert({ service_id: service.id, user_id: tecnico_id });
    }
    await registarEventoServico(supabase, {
      organizationId,
      serviceId: service.id,
      tipo: "agendado",
      descricao: `Agendado para ${data_agendada} ${hora_agendada}–${hora_fim_agendada}.`,
    });
  }

  revalidatePath("/admin/orcamentos");
  redirect(`/admin/servicos/${service.id}`);
}
