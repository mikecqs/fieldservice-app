"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Nota: estas ações só podem ser chamadas por quem já passou o middleware
// de /super-admin (role === SUPER_ADMIN) e, mesmo assim, o insert em
// `organizations` está protegido por RLS (só SUPER_ADMIN pode escrever lá) —
// por isso há duas barreiras independentes, não uma só.

export async function criarEmpresa(formData: FormData) {
  const supabase = createClient();
  const nome = String(formData.get("nome") || "");
  const nif = String(formData.get("nif") || "");
  if (!nome) return;

  const { error } = await supabase.from("organizations").insert({ nome, nif });
  if (error) throw new Error(error.message);

  revalidatePath("/super-admin");
}

export async function criarAdminDaEmpresa(formData: FormData) {
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

  const supabase = createClient();
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
