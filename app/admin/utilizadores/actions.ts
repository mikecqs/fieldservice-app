"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getOrgId, requireRole } from "@/lib/auth";

// BLOCO 19 — antes desta verificação, criarAdminClient().auth.admin.createUser()
// (que cria mesmo uma conta de Auth real, com custo/quota) corria para
// qualquer utilizador autenticado que chamasse esta Server Action
// diretamente (o layout de /admin/utilizadores não protege o endpoint da
// action em si, só a renderização da página) — a única barreira era a RLS
// do insert em "profiles" a seguir, que reverteria a criação. Mesmo padrão
// já usado em app/admin/configuracoes/integracoes-actions.ts antes de
// qualquer uso de createAdminClient().
export async function criarUtilizador(formData: FormData) {
  await requireRole(["ADMIN", "SUPER_ADMIN"]);
  const organizationId = await getOrgId();
  const nome = String(formData.get("nome") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "TECHNICIAN");
  if (!nome || !email || !password) return;
  if (!["ADMIN", "TECHNICIAN", "FINANCE"].includes(role)) return;

  // Criar utilizador de Auth requer a service role key — só corre aqui no
  // servidor, nunca no browser (ver mesmo padrão em super-admin/actions.ts).
  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser?.user) {
    throw new Error(authError?.message || "Não foi possível criar o utilizador.");
  }

  const supabase = createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.user.id,
    organization_id: organizationId,
    role,
    nome,
    email,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(profileError.message);
  }

  revalidatePath("/admin/utilizadores");
}
