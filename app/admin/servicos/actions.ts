"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId, getOrgIdAndRole } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";
import { podeReagendarServico, podeCancelarServico, podeReativarServico, deveTransicionarParaAgendado } from "@/lib/servico-estado";

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
  const supabase = createClient();

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

export async function criarServico(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  const client_id = String(formData.get("client_id") || "");
  const address_id = String(formData.get("address_id") || "");
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "");
  const prioridade = String(formData.get("prioridade") || "normal");
  // "Novo Serviço" já não tem campo de preço na UI — valor nasce sempre 0 e
  // só é preenchido depois, no fecho da visita pelo técnico (tech_finish_visit,
  // BLOCO 14) ou por um orçamento aceite. O guard de sinal fica por defesa
  // em profundidade (nunca confiar só na UI para não haver um valor
  // negativo), mesmo já não havendo forma de o submeter com um valor != 0.
  const valor = Number(formData.get("valor") || 0);

  if (!client_id || !address_id || !tipo || !descricao) return;
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error("Valor do serviço tem de ser um número igual ou superior a 0.");
  }

  // Nunca confiar que o address_id do formulário pertence mesmo ao cliente
  // selecionado — mesma verificação já usada em criarPedido.
  const { data: morada } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("id", address_id)
    .eq("client_id", client_id)
    .single();
  if (!morada) throw new Error("A morada selecionada não pertence ao cliente selecionado.");

  const { data: service, error } = await supabase
    .from("services")
    .insert({ organization_id: organizationId, client_id, address_id, tipo, descricao, prioridade, valor })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar o serviço.");

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: service.id,
    tipo: "criado",
    descricao: `Serviço criado (${tipo}).`,
  });

  revalidatePath("/admin/servicos");
  redirect(`/admin/servicos/${service.id}`);
}

export async function atualizarAgendamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
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

  const { data: current } = await supabase
    .from("services")
    .select("estado, data_agendada, faturacao_estado")
    .eq("id", id)
    .single();
  if (!current) return;

  // Serviço concluído/cancelado/não realizado ou já faturado: agendamento,
  // horário e técnico ficam bloqueados — nunca só escondido na UI (ver
  // AgendamentoForm.tsx, que aplica exatamente a mesma regra).
  if (!podeReagendarServico(current)) {
    throw new Error("Este serviço já não pode ser reagendado (concluído, cancelado, não realizado ou já faturado).");
  }

  const update: Record<string, unknown> = { data_agendada, hora_agendada, hora_fim_agendada, prioridade, notas };
  if (data_agendada && deveTransicionarParaAgendado(current.estado)) update.estado = "agendado";

  await supabase.from("services").update(update).eq("id", id);

  if (data_agendada) {
    const jaTinhaData = !!current?.data_agendada;
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
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const motivo = String(formData.get("motivo") || "").trim();
  if (!id) return;
  if (!motivo) throw new Error("O motivo do cancelamento é obrigatório.");

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", id).single();
  if (!servico) return;
  if (!podeCancelarServico(servico)) {
    throw new Error("Este serviço já não pode ser cancelado (já concluído ou já faturado).");
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
  const supabase = createClient();

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
    throw new Error('Só é possível reativar um serviço que esteja "Não foi possível realizar" e ainda não esteja faturado.');
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
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const equipment_id = String(formData.get("equipment_id") || "") || null;
  if (!id) return;
  await supabase.from("services").update({ equipment_id }).eq("id", id);
  revalidatePath(`/admin/servicos/${id}`);
}

export async function atribuirTecnico(formData: FormData) {
  const supabase = createClient();
  const service_id = String(formData.get("service_id") || "");
  const user_id = String(formData.get("user_id") || "");
  if (!service_id || !user_id) return;

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", service_id).single();
  if (!servico || !podeReagendarServico(servico)) {
    throw new Error("Este serviço já não pode ter técnicos alterados (concluído, cancelado, não realizado ou já faturado).");
  }

  await supabase.from("service_technicians").insert({ service_id, user_id });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerTecnico(formData: FormData) {
  const supabase = createClient();
  const service_id = String(formData.get("service_id") || "");
  const user_id = String(formData.get("user_id") || "");
  if (!service_id || !user_id) return;

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", service_id).single();
  if (!servico || !podeReagendarServico(servico)) {
    throw new Error("Este serviço já não pode ter técnicos alterados (concluído, cancelado, não realizado ou já faturado).");
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
  const supabase = createClient();
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
    throw new Error("Este serviço já não pode ter materiais planeados alterados (concluído, cancelado, não realizado ou já faturado).");
  }

  await supabase.from("service_materials_planned").insert({ service_id, nome, qtd, preco_venda });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerMaterialPlaneado(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const service_id = String(formData.get("service_id") || "");
  if (!id) return;

  const { data: servico } = await supabase.from("services").select("estado, faturacao_estado").eq("id", service_id).single();
  if (!servico || !podeReagendarServico(servico)) {
    throw new Error("Este serviço já não pode ter materiais planeados alterados (concluído, cancelado, não realizado ou já faturado).");
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
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { error } = await supabase.rpc("finance_validar_servico", { p_service_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/faturacao");
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/dashboard");
}

export async function enviarParaCorrecao(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const motivo = String(formData.get("motivo") || "").trim();
  if (!id || !motivo) return;

  const { error } = await supabase.rpc("finance_rejeitar_servico", { p_service_id: id, p_motivo: motivo });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/faturacao");
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/tecnico");
}
