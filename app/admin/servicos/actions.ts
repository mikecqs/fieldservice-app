"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";

// Aviso não-bloqueante de conflito de agenda — chamado pelo formulário antes
// de gravar. Não impede nada sozinho: só devolve a informação para o Admin
// decidir (Cancelar ou Agendar na mesma). A decisão final continua sempre em
// atualizarAgendamento.
export async function verificarConflitoAgenda(input: {
  serviceId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
}) {
  const supabase = createClient();

  const { data: tecnicos } = await supabase
    .from("service_technicians")
    .select("user_id, profiles(nome)")
    .eq("service_id", input.serviceId);

  const tecnicoIds = (tecnicos ?? []).map((t) => t.user_id);
  if (tecnicoIds.length === 0) return { conflito: false as const };

  const { data: outros } = await supabase
    .from("services")
    .select("id, descricao, hora_agendada, hora_fim_agendada, clients(nome), service_technicians!inner(user_id)")
    .eq("data_agendada", input.data)
    .neq("id", input.serviceId)
    .in("service_technicians.user_id", tecnicoIds)
    .not("estado", "in", "(cancelado,concluido,nao_realizado)");

  const conflitos = (outros ?? []).filter(
    (s) => s.hora_agendada && s.hora_fim_agendada && s.hora_agendada < input.horaFim && s.hora_fim_agendada > input.horaInicio
  );

  if (conflitos.length === 0) return { conflito: false as const };

  const nomesTecnicos = (tecnicos ?? []).map((t: any) => t.profiles?.nome).filter(Boolean).join(", ");
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
  const address_id = String(formData.get("address_id") || "") || null;
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "");
  const prioridade = String(formData.get("prioridade") || "normal");
  const valor = Number(formData.get("valor") || 0);

  if (!client_id || !tipo || !descricao) return;

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

  const update: Record<string, unknown> = { data_agendada, hora_agendada, hora_fim_agendada, prioridade, notas };
  const { data: current } = await supabase.from("services").select("estado, data_agendada").eq("id", id).single();
  if (data_agendada && current?.estado === "por_agendar") update.estado = "agendado";

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

export async function mudarEstado(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "");
  if (!id || !estado) return;
  await supabase.from("services").update({ estado }).eq("id", id);
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/servicos");
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
  await supabase.from("service_technicians").insert({ service_id, user_id });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerTecnico(formData: FormData) {
  const supabase = createClient();
  const service_id = String(formData.get("service_id") || "");
  const user_id = String(formData.get("user_id") || "");
  if (!service_id || !user_id) return;
  await supabase.from("service_technicians").delete().eq("service_id", service_id).eq("user_id", user_id);
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function adicionarMaterialPlaneado(formData: FormData) {
  const supabase = createClient();
  const service_id = String(formData.get("service_id") || "");
  const nome = String(formData.get("nome") || "");
  const qtd = Number(formData.get("qtd") || 1);
  if (!service_id || !nome) return;
  await supabase.from("service_materials_planned").insert({ service_id, nome, qtd });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerMaterialPlaneado(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const service_id = String(formData.get("service_id") || "");
  if (!id) return;
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
  revalidatePath("/admin/atencao");
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
  revalidatePath("/admin/atencao");
  revalidatePath("/tecnico");
}
