"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gerarPdfFechoSemBloquear } from "@/lib/pdf-fecho";

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
  if (!faturacao_referencia.trim()) {
    throw new Error("A referência da fatura é obrigatória.");
  }

  const { error } = await supabase.rpc("finance_marcar_faturado", {
    p_service_id: id,
    p_valor: faturacao_valor,
    p_referencia: faturacao_referencia,
  });
  if (error) throw new Error(error.message);

  // PDF do Fecho (Ponto 5) — regenera para incluir a referência/valor/data
  // de faturação; nunca bloqueia a faturação em si (já teve sucesso na RPC).
  await gerarPdfFechoSemBloquear(id, "finance_marcar_faturado");

  revalidatePath("/admin/faturacao");
}
