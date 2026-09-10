"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function redefinirPassword(formData: FormData): Promise<{ erro?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (password.length < 8) {
    return { erro: "A password tem de ter pelo menos 8 caracteres." };
  }
  if (password !== confirmacao) {
    return { erro: "As passwords não coincidem." };
  }

  const supabase = await createClient();

  // Só chega aqui com uma sessão válida se tiver vindo do link de email
  // (verifyOtp em /api/auth/confirm já a estabeleceu) — sem sessão,
  // updateUser falha e devolvemos um erro claro em vez de deixar cair
  // silenciosamente.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erro: "A sua sessão de recuperação expirou. Peça um novo link em /esqueci-password." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { erro: "Não foi possível definir a nova password. Tente pedir um novo link." };
  }

  redirect("/dashboard");
}
