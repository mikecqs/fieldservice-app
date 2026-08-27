"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarFaturado(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get("id") || "");
  const faturacao_valor = Number(formData.get("faturacao_valor") || 0);
  const faturacao_referencia = String(formData.get("faturacao_referencia") || "");
  if (!id) return;

  await supabase
    .from("services")
    .update({
      faturacao_estado: "faturado",
      faturacao_valor,
      faturacao_referencia,
      faturacao_data: new Date().toISOString().slice(0, 10),
      faturacao_utilizador: user!.id,
    })
    .eq("id", id);

  revalidatePath("/admin/faturacao");
}
