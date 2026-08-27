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
  const acesso_sequencial_tecnico = formData.get("acesso_sequencial_tecnico") === "on";

  await supabase
    .from("org_settings")
    .update({ tipos_servico, followup_dias_default, acesso_sequencial_tecnico })
    .eq("organization_id", organizationId);

  revalidatePath("/admin/configuracoes");
}
