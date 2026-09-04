"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

// BLOCO 19 — o layout de /super-admin protege a renderização da página, mas
// nunca o endpoint da Server Action em si (chamável diretamente por
// qualquer sessão autenticada). Cada função valida agora explicitamente
// requireRole(["SUPER_ADMIN"]) antes de qualquer escrita — antes disso, as
// duas ações abaixo que criam utilizador (criarAdminDaEmpresa/
// criarAtendimentoDaEmpresa) chamavam createAdminClient().auth.admin.
// createUser() (cria mesmo uma conta de Auth real) sem nenhuma verificação
// própria, confiando só na RLS do insert em "profiles" a seguir para
// reverter — mesmo padrão já corrigido em app/admin/utilizadores/actions.ts.
// criarEmpresa nunca teve esse risco (não usa createAdminClient, só RLS em
// "organizations"), mas passa a validar aqui também para o comentário
// acima ser verdade em vez de uma suposição.
export async function criarEmpresa(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const supabase = await createClient();
  const nome = String(formData.get("nome") || "");
  const nif = String(formData.get("nif") || "");
  if (!nome) return;

  const { error } = await supabase.from("organizations").insert({ nome, nif });
  if (error) throw new Error(error.message);

  revalidatePath("/super-admin");
}

export async function criarAdminDaEmpresa(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const organizationId = String(formData.get("organization_id") || "");
  const nome = String(formData.get("nome") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!organizationId || !nome || !email || !password) return;

  // Criar um utilizador de Auth requer a service role key — nunca fazer
  // isto a partir do browser. É por isso que esta ação corre só no servidor
  // ("use server") e usa createAdminClient(), não o cliente normal.
  const admin = createAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser?.user) {
    throw new Error(authError?.message || "Não foi possível criar o utilizador.");
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.user.id,
    organization_id: organizationId,
    role: "ADMIN",
    nome,
    email,
  });

  if (profileError) {
    // limpa o utilizador órfão se o perfil falhar, para não ficar por criar
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(profileError.message);
  }

  revalidatePath("/super-admin");
}

// ATENDIMENTO é criado só pelo Super Admin, nunca pelo Admin da empresa —
// a policy "admin can manage profiles in own org" em schema.sql só permite
// ao Admin criar/atualizar ADMIN/TECHNICIAN/FINANCE, por isso mesmo um
// pedido direto à API (fora desta página) seria sempre rejeitado pela RLS.
export async function criarAtendimentoDaEmpresa(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const organizationId = String(formData.get("organization_id") || "");
  const nome = String(formData.get("nome") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!organizationId || !nome || !email || !password) return;

  const admin = createAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser?.user) {
    throw new Error(authError?.message || "Não foi possível criar o utilizador.");
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.user.id,
    organization_id: organizationId,
    role: "ATENDIMENTO",
    nome,
    email,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(profileError.message);
  }

  revalidatePath("/super-admin");
}

// Freeze/reativação de empresa — soft, nunca apaga nada. organizations.ativa
// já existia no schema mas nunca tinha sido ligado a nenhuma ação nem
// enforcement; agora getOrgId/getOrgIdAndRole/requireRole (lib/auth.ts)
// bloqueiam qualquer acesso de utilizadores dessa empresa enquanto ativa
// for false — nunca apaga a empresa nem os dados, só bloqueia o acesso.
export async function alterarEstadoEmpresa(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const ativa = formData.get("ativa") === "true";
  if (!id) return;

  await supabase.from("organizations").update({ ativa }).eq("id", id);
  revalidatePath("/super-admin");
}

// Soft delete de utilizador ao nível do Super Admin — mesmo princípio de
// desativarUtilizador em app/admin/utilizadores/actions.ts, mas sem estar
// limitado à própria empresa do chamador (o Super Admin gere todas).
export async function alterarEstadoUtilizador(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const ativo = formData.get("ativo") === "true";
  if (!id) return;

  const { data: alvo } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (alvo?.role === "SUPER_ADMIN") {
    throw new Error("Não é possível desativar outro Super Admin por aqui.");
  }

  await supabase.from("profiles").update({ ativo }).eq("id", id);
  revalidatePath("/super-admin");
}
