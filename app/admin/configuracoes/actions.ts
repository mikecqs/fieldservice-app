"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function guardarConfiguracoes(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  const tipos_servico = String(formData.get("tipos_servico") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const followup_dias_default = Number(formData.get("followup_dias_default") || 3);
  if (!Number.isFinite(followup_dias_default) || followup_dias_default < 0) {
    throw new Error("Os dias de follow-up têm de ser um número igual ou superior a 0.");
  }

  await supabase
    .from("org_settings")
    .update({ tipos_servico, followup_dias_default })
    .eq("organization_id", organizationId);

  revalidatePath("/admin/configuracoes");
}
