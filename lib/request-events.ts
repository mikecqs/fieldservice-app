import { createClient } from "@/lib/supabase/server";

type RequestEventTipo = "editado";

// Histórico de edição do Pedido — mesmo espírito de registarEventoServico/
// registarEventoOrcamento, mas para campos livres (descrição/morada) em vez
// de transições de estado.
export async function registarEventoPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { organizationId: string; requestId: string; tipo: RequestEventTipo; descricao: string; userId?: string }
) {
  let userId = params.userId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }
  await supabase.from("request_events").insert({
    organization_id: params.organizationId,
    request_id: params.requestId,
    tipo: params.tipo,
    descricao: params.descricao,
    utilizador: userId,
  });
}
