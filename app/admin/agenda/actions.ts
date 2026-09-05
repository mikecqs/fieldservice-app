"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";
import { escreverAgendamentoServico } from "@/lib/agendamento-servico";
import { assertTecnicoPertenceOrg } from "@/lib/tenant-guard";

// Auditoria "Centralizar criação" (Ponto 2) — esta ação criava também
// Serviços novos diretamente na Agenda (ramo `else` abaixo, removido), sem
// passar por Pedido nenhum. Regra atual: Pedido → Serviço → Agenda. A Agenda
// só agenda Serviços que já existem (sempre com request_id ou budget_id —
// nunca órfãos); nunca cria Pedido nem Serviço a partir daqui.
export async function agendarServicoExistente(input: {
  existingServiceId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  tecnicoId?: string | null;
}) {
  const organizationId = await getOrgId();
  const supabase = await createClient();

  if (!input.existingServiceId) {
    throw new Error("Seleciona o serviço a agendar.");
  }
  if (!input.data || !input.horaInicio || !input.horaFim) {
    throw new Error("Hora de início e hora de fim são ambas obrigatórias para agendar.");
  }
  // Mesma regra já aplicada em reativarServico/atualizarAgendamento — nunca
  // duas versões divergentes da mesma validação entre os caminhos de
  // agendamento (BLOCO 18).
  if (input.horaFim <= input.horaInicio) {
    throw new Error("A hora de término deve ser depois da hora de início.");
  }

  const serviceId = input.existingServiceId;

  // Onda 3 (Etapa 5) — a leitura do estado atual, o guard
  // podeReagendarServico e o próprio .update() em `services` ficaram numa
  // única função partilhada com atualizarAgendamento
  // (lib/agendamento-servico.ts).
  const anterior = await escreverAgendamentoServico(supabase, {
    serviceId,
    dataAgendada: input.data,
    horaAgendada: input.horaInicio,
    horaFimAgendada: input.horaFim,
  });
  if (!anterior) throw new Error("Serviço não encontrado.");

  await registarEventoServico(supabase, {
    organizationId,
    serviceId,
    tipo: anterior.data_agendada ? "reagendado" : "agendado",
    descricao: `${anterior.data_agendada ? "Reagendado" : "Agendado"} para ${input.data} ${input.horaInicio}–${input.horaFim} a partir da agenda.`,
  });

  if (input.tecnicoId) {
    // Finding 1 — mesmo motivo de reativarServico/atribuirTecnico.
    await assertTecnicoPertenceOrg(supabase, input.tecnicoId, organizationId);
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
  revalidatePath("/admin/dashboard");

  return serviceId;
}
