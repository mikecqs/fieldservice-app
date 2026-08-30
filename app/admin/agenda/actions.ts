"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";
import { escreverAgendamentoServico } from "@/lib/agendamento-servico";

// Ação única usada pelo popup da Agenda — cobre os dois modos do modal
// (agendar um serviço já existente, ou criar um serviço novo já agendado,
// opcionalmente a partir de um pedido) para evitar o fluxo antigo de
// Criar Pedido → Agenda → Criar Serviço → Agenda em páginas separadas.
export async function criarOuAgendarNoPopup(input: {
  existingServiceId?: string | null;
  clientId?: string | null;
  addressId?: string | null;
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
    // Onda 3 (Etapa 5) — a leitura do estado atual, o guard
    // podeReagendarServico e o próprio .update() em `services` ficaram numa
    // única função partilhada com atualizarAgendamento
    // (lib/agendamento-servico.ts). Este fluxo continua a exigir sempre os
    // três campos preenchidos (validado acima) e continua a lançar erro
    // quando o serviço não é encontrado — nunca em silêncio, diferente de
    // atualizarAgendamento, porque é esse o comportamento já existente aqui.
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
  } else {
    if (!input.clientId || !input.addressId || !input.tipo || !input.descricao) {
      throw new Error("Cliente, morada, tipo e descrição são obrigatórios para criar um novo agendamento.");
    }

    // Nunca confiar que a morada do formulário pertence mesmo ao cliente
    // selecionado — mesma verificação já usada em criarPedido/criarServico.
    const { data: morada } = await supabase
      .from("client_addresses")
      .select("id")
      .eq("id", input.addressId)
      .eq("client_id", input.clientId)
      .single();
    if (!morada) throw new Error("A morada selecionada não pertence ao cliente selecionado.");

    const { data: service, error } = await supabase
      .from("services")
      .insert({
        organization_id: organizationId,
        client_id: input.clientId,
        address_id: input.addressId,
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
  revalidatePath("/admin/dashboard");

  return serviceId as string;
}
