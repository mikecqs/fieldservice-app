"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";
import { podeReagendarServico, deveTransicionarParaAgendado } from "@/lib/servico-estado";

// Ação única usada pelo popup da Agenda — cobre os dois modos do modal
// (agendar um serviço já existente, ou criar um serviço novo já agendado,
// opcionalmente a partir de um pedido) para evitar o fluxo antigo de
// Criar Pedido → Agenda → Criar Serviço → Agenda em páginas separadas.
export async function criarOuAgendarNoPopup(input: {
  existingServiceId?: string | null;
  clientId?: string | null;
  requestId?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  prioridade?: string | null;
  data: string;
  horaInicio: string;
  horaFim: string;
  tecnicoId?: string | null;
}) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  if (!input.data || !input.horaInicio || !input.horaFim) {
    throw new Error("Hora de início e hora de fim são ambas obrigatórias para agendar.");
  }
  // Mesma regra já aplicada em reativarServico/atualizarAgendamento — nunca
  // duas versões divergentes da mesma validação entre os caminhos de
  // agendamento (BLOCO 18).
  if (input.horaFim <= input.horaInicio) {
    throw new Error("A hora de término deve ser depois da hora de início.");
  }

  let serviceId = input.existingServiceId || null;

  if (serviceId) {
    const { data: current } = await supabase
      .from("services")
      .select("estado, data_agendada, faturacao_estado")
      .eq("id", serviceId)
      .single();
    if (!current) throw new Error("Serviço não encontrado.");

    // Mesma regra de app/admin/servicos/actions.ts (atualizarAgendamento) —
    // nunca duas versões diferentes desta validação (auditoria BLOCO 5).
    if (!podeReagendarServico(current)) {
      throw new Error("Este serviço já não pode ser reagendado (concluído, cancelado, não realizado ou já faturado).");
    }

    const update: Record<string, unknown> = {
      data_agendada: input.data,
      hora_agendada: input.horaInicio,
      hora_fim_agendada: input.horaFim,
    };
    if (deveTransicionarParaAgendado(current.estado)) update.estado = "agendado";

    await supabase.from("services").update(update).eq("id", serviceId);
    await registarEventoServico(supabase, {
      organizationId,
      serviceId,
      tipo: current.data_agendada ? "reagendado" : "agendado",
      descricao: `${current.data_agendada ? "Reagendado" : "Agendado"} para ${input.data} ${input.horaInicio}–${input.horaFim} a partir da agenda.`,
    });
  } else {
    if (!input.clientId || !input.tipo || !input.descricao) {
      throw new Error("Cliente, tipo e descrição são obrigatórios para criar um novo agendamento.");
    }

    const { data: service, error } = await supabase
      .from("services")
      .insert({
        organization_id: organizationId,
        client_id: input.clientId,
        request_id: input.requestId || null,
        tipo: input.tipo,
        descricao: input.descricao,
        prioridade: input.prioridade || "normal",
        data_agendada: input.data,
        hora_agendada: input.horaInicio,
        hora_fim_agendada: input.horaFim,
        estado: "agendado",
      })
      .select()
      .single();
    if (error || !service) throw new Error(error?.message || "Não foi possível criar o serviço.");
    serviceId = service.id;

    if (input.requestId) {
      await supabase.from("requests").update({ estado: "convertido" }).eq("id", input.requestId);
    }

    await registarEventoServico(supabase, {
      organizationId,
      serviceId: serviceId as string,
      tipo: "criado",
      descricao: `Serviço criado e agendado diretamente na agenda para ${input.data} ${input.horaInicio}–${input.horaFim}.`,
    });
  }

  if (input.tecnicoId) {
    const { data: jaAtribuido } = await supabase
      .from("service_technicians")
      .select("user_id")
      .eq("service_id", serviceId)
      .eq("user_id", input.tecnicoId)
      .maybeSingle();
    if (!jaAtribuido) {
      await supabase.from("service_technicians").insert({ service_id: serviceId, user_id: input.tecnicoId });
    }
  }

  revalidatePath("/admin/agenda");
  revalidatePath("/admin/servicos");
  revalidatePath(`/admin/servicos/${serviceId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/atencao");

  return serviceId as string;
}
