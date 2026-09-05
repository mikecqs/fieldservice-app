"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId, getOrgIdAndRole } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";
import { podeReagendarServico, podeCancelarServico, podeReativarServico, podeGerarOrcamentoDeVisita } from "@/lib/servico-estado";
import { escreverAgendamentoServico } from "@/lib/agendamento-servico";
import { criarOrcamentoDePedido } from "../pedidos/actions";
import { gerarPdfFechoSemBloquear } from "@/lib/pdf-fecho";
import { assertTecnicoPertenceOrg } from "@/lib/tenant-guard";

// Aviso não-bloqueante de conflito de agenda — chamado pelo formulário antes
// de gravar. Não impede nada sozinho: só devolve a informação para o Admin
// decidir (Cancelar ou Agendar na mesma). A decisão final continua sempre em
// atualizarAgendamento.
export async function verificarConflitoAgenda(input: {
  // Um serviço já existente (edição) deriva os técnicos a partir dele; um
  // agendamento ainda por criar (popup da agenda) ainda não tem serviceId,
  // por isso pode indicar diretamente que técnicos vão ser atribuídos.
  serviceId?: string;
  technicianIds?: string[];
  data: string;
  horaInicio: string;
  horaFim: string;
}) {
  const supabase = await createClient();

  let tecnicoIds = input.technicianIds ?? [];
  let nomesConhecidos: Record<string, string> = {};
  if (tecnicoIds.length > 0) {
    const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", tecnicoIds);
    nomesConhecidos = Object.fromEntries((perfis ?? []).map((p) => [p.id, p.nome]));
  } else if (input.serviceId) {
    const { data: tecnicos } = await supabase
      .from("service_technicians")
      .select("user_id, profiles(nome)")
      .eq("service_id", input.serviceId);
    tecnicoIds = (tecnicos ?? []).map((t) => t.user_id);
    nomesConhecidos = Object.fromEntries((tecnicos ?? []).map((t: any) => [t.user_id, t.profiles?.nome]).filter(([, n]) => n));
  }
  if (tecnicoIds.length === 0) return { conflito: false as const };

  let query = supabase
    .from("services")
    .select("id, descricao, hora_agendada, hora_fim_agendada, clients(nome), service_technicians!inner(user_id)")
    .eq("data_agendada", input.data)
    .in("service_technicians.user_id", tecnicoIds)
    .not("estado", "in", "(cancelado,concluido,nao_realizado)");
  if (input.serviceId) query = query.neq("id", input.serviceId);
  const { data: outros } = await query;

  const conflitos = (outros ?? []).filter(
    (s) => s.hora_agendada && s.hora_fim_agendada && s.hora_agendada < input.horaFim && s.hora_fim_agendada > input.horaInicio
  );

  if (conflitos.length === 0) return { conflito: false as const };

  const nomesTecnicos = tecnicoIds.map((id) => nomesConhecidos[id]).filter(Boolean).join(", ");
  const detalhes = conflitos
    .map((s: any) => `${s.clients?.nome ?? "cliente"} às ${s.hora_agendada?.slice(0, 5)}–${s.hora_fim_agendada?.slice(0, 5)}`)
    .join("; ");

  return {
    conflito: true as const,
    mensagem: `${nomesTecnicos || "Este técnico"} já tem outro serviço nesse horário: ${detalhes}.`,
  };
}

// Onda 3 (Etapa 9) — criarServico() (criação independente de Serviço, usada
// só por /admin/servicos/novo) foi removida: essa rota deixou de existir
// (decisão C da auditoria) — criar um Serviço passa sempre pelo fluxo de
// Pedido (criarPedido/criarServicoDePedido, em app/admin/pedidos/actions.ts)
// ou pela Agenda (criarOuAgendarNoPopup, em app/admin/agenda/actions.ts),
// nenhum dos quais foi tocado por esta remoção.

export async function atualizarAgendamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const data_agendada = String(formData.get("data_agendada") || "") || null;
  const hora_agendada = String(formData.get("hora_agendada") || "") || null;
  const hora_fim_agendada = String(formData.get("hora_fim_agendada") || "") || null;
  const prioridade = String(formData.get("prioridade") || "normal");
  const notas = String(formData.get("notas") || "");

  // Data e hora de início e fim andam sempre juntas: ou as três estão
  // preenchidas (agenda-se), ou nenhuma está (fica por agendar) — nunca uma
  // OS com data mas sem hora de fim, que é o que tornava impossível desenhar
  // um calendário visual a sério.
  if (data_agendada && (!hora_agendada || !hora_fim_agendada)) {
    throw new Error("Hora de início e hora de fim são ambas obrigatórias para agendar.");
  }
  // Mesma regra já aplicada em reativarServico — faltava aqui, o caminho de
  // agendamento mais usado (ficha do Serviço). Nunca duas versões
  // divergentes da mesma validação (BLOCO 18).
  if (hora_agendada && hora_fim_agendada && hora_fim_agendada <= hora_agendada) {
    throw new Error("A hora de término deve ser depois da hora de início.");
  }

  // Onda 3 (Etapa 5) — a leitura do estado atual, o guard
  // podeReagendarServico e o próprio .update() em `services` ficaram numa
  // única função partilhada com criarOuAgendarNoPopup (lib/agendamento-servico.ts).
  // "Serviço não encontrado" continua a resolver-se em silêncio aqui —
  // exatamente como antes, nunca lançado — porque é esse o comportamento
  // já existente deste fluxo (diferente do da Agenda, que lança erro).
  const anterior = await escreverAgendamentoServico(supabase, {
    serviceId: id,
    dataAgendada: data_agendada,
    horaAgendada: hora_agendada,
    horaFimAgendada: hora_fim_agendada,
    camposExtra: { prioridade, notas },
  });
  if (!anterior) return;

  if (data_agendada) {
    const jaTinhaData = !!anterior.data_agendada;
    await registarEventoServico(supabase, {
      organizationId,
      serviceId: id,
      tipo: jaTinhaData ? "reagendado" : "agendado",
      descricao: jaTinhaData
        ? `Reagendado para ${data_agendada} ${hora_agendada}–${hora_fim_agendada}.`
        : `Agendado para ${data_agendada} ${hora_agendada}–${hora_fim_agendada}.`,
    });
  }

  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/agenda");
}

// Substitui o antigo "Forçar estado manualmente" (um <select> que permitia
// saltar para qualquer estado sem validação nem histórico — auditoria
// BLOCO 5). Cancelar é a única transição manual que legitimamente não tem
// nenhum outro caminho no sistema; por isso é uma ação própria, com motivo
// obrigatório, validação de estado no servidor e evento sempre registado.
export async function cancelarServico(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const motivo = String(formData.get("motivo") || "").trim();
  if (!id) return;
  if (!motivo) throw new Error("O motivo do cancelamento é obrigatório.");

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", id).single();
  if (!servico) return;
  if (!podeCancelarServico(servico)) {
    throw new Error("Este serviço já não pode ser cancelado (já concluído, já faturado ou liquidado).");
  }

  await supabase.from("services").update({ estado: "cancelado" }).eq("id", id);

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: id,
    tipo: "cancelado",
    descricao: `Serviço cancelado: ${motivo}`,
  });

  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/servicos");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/dashboard");
}

// Único caminho de saída de 'nao_realizado' — não é um "forçar estado"
// genérico (isso foi removido de propósito na auditoria BLOCO 5): só atua
// sobre este estado exato, nunca se já estiver faturado, exige sempre nova
// data/hora, e reutiliza a mesma lógica de conflito/técnico já usada na
// Agenda (verificarConflitoAgenda é chamado pelo formulário antes disto,
// tal como acontece em AgendamentoForm/ServicoModal). Explicitamente
// restrita a ADMIN/SUPER_ADMIN, com validação sempre no servidor — nunca
// confia no estado nem no id vindos do browser sem revalidar aqui.
export async function reativarServico(formData: FormData) {
  const { organizationId, role } = await getOrgIdAndRole();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Sem permissão para reativar este serviço.");
  }
  const supabase = await createClient();

  const id = String(formData.get("id") || "");
  const data_agendada = String(formData.get("data_agendada") || "");
  const hora_agendada = String(formData.get("hora_agendada") || "");
  const hora_fim_agendada = String(formData.get("hora_fim_agendada") || "");
  const tecnicoId = String(formData.get("tecnico_id") || "") || null;

  if (!id) return;
  if (!data_agendada || !hora_agendada || !hora_fim_agendada) {
    throw new Error("Data, hora de início e hora de fim são obrigatórias para reativar o serviço.");
  }
  if (hora_fim_agendada <= hora_agendada) {
    throw new Error("A hora de término deve ser depois da hora de início.");
  }

  // Revalida sempre a partir da BD — nunca confia no estado que a página
  // tinha carregada no browser no momento em que o formulário foi aberto.
  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", id).single();
  if (!servico) return;
  if (!podeReativarServico(servico)) {
    throw new Error('Só é possível reativar um serviço que esteja "Não foi possível realizar" e ainda não esteja faturado nem liquidado.');
  }

  await supabase
    .from("services")
    .update({
      estado: "agendado",
      data_agendada,
      hora_agendada,
      hora_fim_agendada,
    })
    .eq("id", id);

  // Técnico é opcional aqui, tal como no resto do fluxo de agendamento
  // (atualizarAgendamento/criarOuAgendarNoPopup): a atribuição de técnico
  // nunca foi uma condição para um serviço ficar "agendado".
  let nomeTecnico: string | null = null;
  if (tecnicoId) {
    // Finding 1 — service_technicians não tem organization_id próprio; a
    // sua RLS só valida a organização do service_id, nunca a do user_id
    // atribuído.
    await assertTecnicoPertenceOrg(supabase, tecnicoId, organizationId);
    const { data: jaAtribuido } = await supabase
      .from("service_technicians")
      .select("user_id")
      .eq("service_id", id)
      .eq("user_id", tecnicoId)
      .maybeSingle();
    if (!jaAtribuido) {
      await supabase.from("service_technicians").insert({ service_id: id, user_id: tecnicoId });
    }
    const { data: tecnico } = await supabase.from("profiles").select("nome").eq("id", tecnicoId).single();
    nomeTecnico = tecnico?.nome ?? null;
  }

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: id,
    tipo: "reativado",
    descricao: `Serviço reativado (estava "Não foi possível realizar") e reagendado para ${data_agendada} ${hora_agendada}–${hora_fim_agendada}${
      nomeTecnico ? ` com ${nomeTecnico}` : ""
    }.`,
  });

  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/servicos");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/dashboard");
}

// Liga (ou desliga) este serviço a um equipamento do cliente — é isto que
// faz o histórico do equipamento (na ficha do cliente) mostrar as
// intervenções futuras/passadas relacionadas com ele.
export async function associarEquipamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const equipment_id = String(formData.get("equipment_id") || "") || null;
  if (!id) return;

  if (equipment_id) {
    // Finding 1 — services.equipment_id referencia client_equipment, mas a
    // RLS de UPDATE em "services" só valida a organização da PRÓPRIA linha,
    // nunca a do equipamento associado. Confirma também que o equipamento é
    // do MESMO cliente do serviço — associar o equipamento de outro cliente
    // (ainda que da mesma empresa) não faz sentido de negócio e corromperia
    // o histórico do equipamento na ficha do cliente errado.
    const { data: servico } = await supabase.from("services").select("client_id").eq("id", id).single();
    if (!servico) return;
    const { data: equipamento } = await supabase
      .from("client_equipment")
      .select("id")
      .eq("id", equipment_id)
      .eq("organization_id", organizationId)
      .eq("client_id", servico.client_id)
      .maybeSingle();
    if (!equipamento) throw new Error("Este equipamento não pertence ao cliente deste serviço.");
  }

  await supabase.from("services").update({ equipment_id }).eq("id", id);
  revalidatePath(`/admin/servicos/${id}`);
}

export async function atribuirTecnico(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const service_id = String(formData.get("service_id") || "");
  const user_id = String(formData.get("user_id") || "");
  if (!service_id || !user_id) return;

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", service_id).single();
  if (!servico || !podeReagendarServico(servico)) {
    throw new Error("Este serviço já não pode ter técnicos alterados (concluído, cancelado, não realizado, já faturado ou liquidado).");
  }

  // Finding 1 — mesmo motivo de reativarServico/aceitarOrcamento acima.
  await assertTecnicoPertenceOrg(supabase, user_id, organizationId);

  await supabase.from("service_technicians").insert({ service_id, user_id });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerTecnico(formData: FormData) {
  const supabase = await createClient();
  const service_id = String(formData.get("service_id") || "");
  const user_id = String(formData.get("user_id") || "");
  if (!service_id || !user_id) return;

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", service_id).single();
  if (!servico || !podeReagendarServico(servico)) {
    throw new Error("Este serviço já não pode ter técnicos alterados (concluído, cancelado, não realizado, já faturado ou liquidado).");
  }

  await supabase.from("service_technicians").delete().eq("service_id", service_id).eq("user_id", user_id);
  revalidatePath(`/admin/servicos/${service_id}`);
}

// Mesmo guard de estado já usado para técnicos (atribuirTecnico/
// removerTecnico, BLOCO 5) — um serviço concluído/cancelado/não realizado
// ou já faturado não deve ter a lista planeada de materiais alterada depois
// do facto (BLOCO 16). Nunca um estado/regra novos, reutiliza sempre
// podeReagendarServico.
export async function adicionarMaterialPlaneado(formData: FormData) {
  const supabase = await createClient();
  const service_id = String(formData.get("service_id") || "");
  const nome = String(formData.get("nome") || "");
  const qtd = Number(formData.get("qtd") || 1);
  const preco_venda = Number(formData.get("preco_venda") || 0);
  if (!service_id || !nome) return;
  if (!Number.isFinite(qtd) || qtd < 0 || !Number.isFinite(preco_venda) || preco_venda < 0) {
    throw new Error("Quantidade e preço têm de ser números iguais ou superiores a 0.");
  }

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", service_id).single();
  if (!servico || !podeReagendarServico(servico)) {
    throw new Error("Este serviço já não pode ter materiais planeados alterados (concluído, cancelado, não realizado, já faturado ou liquidado).");
  }

  await supabase.from("service_materials_planned").insert({ service_id, nome, qtd, preco_venda });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerMaterialPlaneado(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const service_id = String(formData.get("service_id") || "");
  if (!id) return;

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", service_id).single();
  if (!servico || !podeReagendarServico(servico)) {
    throw new Error("Este serviço já não pode ter materiais planeados alterados (concluído, cancelado, não realizado, já faturado ou liquidado).");
  }

  await supabase.from("service_materials_planned").delete().eq("id", id);
  revalidatePath(`/admin/servicos/${service_id}`);
}

// O técnico nunca chega a estas duas ações: não tem policy nenhuma nas RPCs
// abaixo. Admin e Financeiro (role FINANCE) partilham o mesmo caminho —
// finance_validar_servico/finance_rejeitar_servico validam a permissão e o
// estado sempre dentro da própria função (SECURITY DEFINER), nunca confiando
// só em esconder o botão no frontend. Cada ação fica sempre registada no
// histórico, mesmo que a mesma OS seja corrigida e reavaliada várias vezes.
export async function validarServico(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { error } = await supabase.rpc("finance_validar_servico", { p_service_id: id });
  if (error) throw new Error(error.message);

  // PDF do Fecho (Ponto 5) — regenera para incluir a validação; nunca
  // bloqueia a validação em si (já teve sucesso na RPC acima).
  await gerarPdfFechoSemBloquear(id, "finance_validar_servico");

  revalidatePath("/admin/faturacao");
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/dashboard");
}

// Único caminho de saída de uma Visita Prévia concluída (Fluxo A) — gera o
// Orçamento reutilizando exatamente criarOrcamentoDePedido (a mesma função
// já usada quando o pedido nunca passa por visita nenhuma), nunca uma
// segunda versão da mesma lógica. Bloqueado se o serviço não for mesmo uma
// Visita Prévia já concluída (podeGerarOrcamentoDeVisita); se o pedido já
// tiver um orçamento (ex: clique duplo), liga-se a essa visita a ele em vez
// de criar um segundo. Em ambos os casos a própria visita fica sempre
// ligada ao Orçamento via `budget_id` — nunca fica por trás, tal como o
// Fluxo B já faz desde a criação — para (a) o botão "Criar orçamento a
// partir desta visita" deixar de aparecer aqui (podeGerarOrcamentoDeVisita
// exige `!budget_id`) e (b) futuras análises encontrarem todas as visitas
// de um Orçamento por `budget_id`, sejam do Fluxo A ou do Fluxo B.
export async function criarOrcamentoDeVisita(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: servico } = await supabase
    .from("services")
    .select("tipo, estado, request_id, budget_id, client_id")
    .eq("id", id)
    .single();
  if (!servico || !podeGerarOrcamentoDeVisita(servico)) {
    throw new Error("Este serviço não é uma Visita Prévia já concluída.");
  }

  const { data: orcamentoExistente } = await supabase
    .from("budgets")
    .select("id")
    .eq("request_id", servico.request_id as string)
    .maybeSingle();
  if (orcamentoExistente) {
    await supabase.from("services").update({ budget_id: orcamentoExistente.id }).eq("id", id);
    redirect(`/admin/orcamentos/${orcamentoExistente.id}`);
  }

  const budget = await criarOrcamentoDePedido(supabase, organizationId, servico.request_id as string, servico.client_id);
  await supabase.from("services").update({ budget_id: budget.id }).eq("id", id);
  revalidatePath(`/admin/servicos/${id}`);
  redirect(`/admin/orcamentos/${budget.id}`);
}

export async function enviarParaCorrecao(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const motivo = String(formData.get("motivo") || "").trim();
  if (!id || !motivo) return;

  const { error } = await supabase.rpc("finance_rejeitar_servico", { p_service_id: id, p_motivo: motivo });
  if (error) throw new Error(error.message);

  // PDF do Fecho (Ponto 5) — regenera para refletir a devolução para
  // correção; quando o Técnico fechar de novo, o passo em
  // app/tecnico/actions.ts regenera outra vez, substituindo este.
  await gerarPdfFechoSemBloquear(id, "finance_rejeitar_servico");

  revalidatePath("/admin/faturacao");
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/tecnico");
}
