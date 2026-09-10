"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function entrar(formData: FormData): Promise<{ erro?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { erro: "Preencha email e password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // GoTrue devolve o mesmo tipo de erro para password errada e para
    // conta por confirmar — sem distinguir, "email ou password
    // incorretos" é enganador quando a causa real é só faltar confirmar
    // o email (situação normal se o projeto tiver "Confirm email"
    // ativo), levando a pensar que a password está errada quando não está.
    if (error.code === "email_not_confirmed") {
      return { erro: "Ainda não confirmou o email desta conta. Verifique a caixa de entrada (e spam)." };
    }
    return { erro: "Email ou password incorretos." };
  }

  redirect("/dashboard");
}
