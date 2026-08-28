import { createClient } from "@/lib/supabase/server";

type BudgetEventTipo = "criado" | "enviado" | "followup" | "aceite" | "recusado" | "cancelado";

// Histórico do orçamento — mesmo espírito de registarEventoServico.
export async function registarEventoOrcamento(
  supabase: ReturnType<typeof createClient>,
  params: { organizationId: string; budgetId: string; tipo: BudgetEventTipo; descricao: string; userId?: string }
) {
  let userId = params.userId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }
  await supabase.from("budget_events").insert({
    organization_id: params.organizationId,
    budget_id: params.budgetId,
    tipo: params.tipo,
    descricao: params.descricao,
    utilizador: userId,
  });
}
