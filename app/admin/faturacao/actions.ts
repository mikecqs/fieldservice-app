"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Admin e Financeiro (role FINANCE) partilham a mesma RPC — ver
// finance_marcar_faturado em schema.sql, que valida permissão e estado
// sempre no próprio Postgres, nunca só no frontend.
export async function marcarFaturado(formData: FormData) {
  const supabase = createClient();

  const id = String(formData.get("id") || "");
  const faturacao_valor = Number(formData.get("faturacao_valor") || 0);
  const faturacao_referencia = String(formData.get("faturacao_referencia") || "");
  if (!id) return;
  // Mesma validação de sinal do valor de criarServico (BLOCO 14/15) — a RPC
  // valida permissão e estado, mas não o sinal do valor recebido.
  if (!Number.isFinite(faturacao_valor) || faturacao_valor < 0) {
    throw new Error("O valor de faturação tem de ser um número igual ou superior a 0.");
  }

  const { error } = await supabase.rpc("finance_marcar_faturado", {
    p_service_id: id,
    p_valor: faturacao_valor,
    p_referencia: faturacao_referencia,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/faturacao");
}
