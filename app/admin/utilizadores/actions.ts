"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function criarUtilizador(formData: FormData) {
  const organizationId = await getOrgId();
  const nome = String(formData.get("nome") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "TECHNICIAN");
  if (!nome || !email || !password) return;
  if (role !== "ADMIN" && role !== "TECHNICIAN") return;

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
