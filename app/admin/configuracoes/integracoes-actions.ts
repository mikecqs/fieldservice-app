"use server";

import { revalidatePath } from "next/cache";
import { getOrgId, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { processOrgQueue } from "@/lib/google-sheets/process-queue";

export async function sincronizarAgora() {
  await requireRole(["ADMIN", "SUPER_ADMIN"]);
  const organizationId = await getOrgId();
  const admin = createAdminClient();
  await processOrgQueue(admin, organizationId);
  revalidatePath("/admin/configuracoes");
}

export async function desligarGoogleSheets() {
  await requireRole(["ADMIN", "SUPER_ADMIN"]);
  const organizationId = await getOrgId();
  const admin = createAdminClient();

  const { data: integration } = await admin
    .from("google_sheets_integrations")
    .select("refresh_token")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (integration?.refresh_token) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${integration.refresh_token}`, { method: "POST" });
    } catch {
      // mesmo que a revogação falhe do lado da Google, continuamos a
      // desligar e a apagar o token cá — nunca deixamos a app a tentar
      // voltar a usá-lo.
    }
  }

  await admin
    .from("google_sheets_integrations")
    .update({ status: "desligado", refresh_token: null, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);

  revalidatePath("/admin/configuracoes");
}
