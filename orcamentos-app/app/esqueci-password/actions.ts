"use server";

import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export async function pedirRecuperacaoPassword(formData: FormData): Promise<{ erro?: string; enviado?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { erro: "Indique o email da conta." };
  }

  const supabase = await createClient();
  const origem = await siteUrl();

  // O Supabase Auth já não revela se o email tem ou não conta associada
  // (resetPasswordForEmail devolve sempre sucesso do lado da API) — por
  // isso a resposta ao utilizador é sempre a mesma, mesmo que a chamada
  // falhe (rede/rate limit): nunca dar a um atacante uma forma de
  // distinguir "conta existe" de "conta não existe" através desta página
  // (mesma preocupação de enumeração já corrigida no signup).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/api/auth/confirm?next=/reset-password`,
  });

  return { enviado: true };
}
