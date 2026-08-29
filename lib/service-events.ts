import { createClient } from "@/lib/supabase/server";

type ServiceEventTipo =
  | "criado"
  | "agendado"
  | "reagendado"
  | "iniciado"
  | "concluido"
  | "nova_visita"
  | "nao_realizado"
  | "correcao_pedida"
  | "corrigido"
  | "validado"
  | "faturado"
  | "cancelado"
  | "reativado";

// Único ponto de escrita do histórico operacional da OS a partir de ações do
// Admin — as ações do técnico (iniciar/terminar) já registam o próprio
// evento dentro das RPCs SECURITY DEFINER (tech_start_service/tech_finish_visit).
export async function registarEventoServico(
  supabase: ReturnType<typeof createClient>,
  params: { organizationId: string; serviceId: string; tipo: ServiceEventTipo; descricao: string; userId?: string }
) {
  let userId = params.userId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }
  await supabase.from("service_events").insert({
    organization_id: params.organizationId,
    service_id: params.serviceId,
    tipo: params.tipo,
    descricao: params.descricao,
    utilizador: userId,
  });
}
