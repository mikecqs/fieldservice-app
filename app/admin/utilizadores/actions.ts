"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getOrgId, getOrgIdAndRole, requireRole } from "@/lib/auth";

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

// Soft delete — nunca apaga a conta nem o histórico associado (ex:
// service_events.utilizador continua a apontar para este perfil). Só
// bloqueia o acesso: getOrgId/getOrgIdAndRole/requireRole (lib/auth.ts)
// verificam "ativo" e redirecionam para /login em qualquer tentativa de
// uso, mesmo direta a uma Server Action.
export async function desativarUtilizador(formData: FormData) {
  const { organizationId, role: chamadorRole } = await getOrgIdAndRole();
  if (chamadorRole !== "ADMIN" && chamadorRole !== "SUPER_ADMIN") {
    throw new Error("Sem permissão para desativar utilizadores.");
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = String(formData.get("id") || "");
  if (!id) return;
  if (id === user?.id) {
    throw new Error("Não podes desativar a tua própria conta.");
  }

  const { data: alvo } = await supabase.from("profiles").select("role, organization_id").eq("id", id).single();
  if (!alvo || alvo.organization_id !== organizationId) return;
  if (alvo.role === "SUPER_ADMIN") {
    throw new Error("Não é possível desativar um Super Admin por aqui.");
  }

  await supabase.from("profiles").update({ ativo: false }).eq("id", id);
  revalidatePath("/admin/utilizadores");
}

export async function reativarUtilizador(formData: FormData) {
  const { organizationId, role: chamadorRole } = await getOrgIdAndRole();
  if (chamadorRole !== "ADMIN" && chamadorRole !== "SUPER_ADMIN") {
    throw new Error("Sem permissão para reativar utilizadores.");
  }
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: alvo } = await supabase.from("profiles").select("organization_id").eq("id", id).single();
  if (!alvo || alvo.organization_id !== organizationId) return;

  await supabase.from("profiles").update({ ativo: true }).eq("id", id);
  revalidatePath("/admin/utilizadores");
}

// Reaproveita exatamente o mesmo mecanismo de "Esqueci-me da password"
// (app/esqueci-password/page.tsx) — envia um email de reset real, o Admin
// nunca vê nem define a password do outro utilizador diretamente.
export async function resetPasswordUtilizador(formData: FormData) {
  const { organizationId, role: chamadorRole } = await getOrgIdAndRole();
  if (chamadorRole !== "ADMIN" && chamadorRole !== "SUPER_ADMIN") {
    throw new Error("Sem permissão para repor password de outro utilizador.");
  }
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: alvo } = await supabase.from("profiles").select("email, organization_id, role").eq("id", id).single();
  if (!alvo || alvo.organization_id !== organizationId) return;
  if (alvo.role === "SUPER_ADMIN") {
    throw new Error("Não é possível repor a password de um Super Admin por aqui.");
  }

  const host = headers().get("host");
  const origin = host ? `https://${host}` : `https://${process.env.VERCEL_URL ?? "localhost:3000"}`;

  const { error } = await supabase.auth.resetPasswordForEmail(alvo.email, {
    redirectTo: `${origin}/redefinir-password`,
  });
  if (error) throw new Error(error.message);
}
