"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function criarConta(formData: FormData): Promise<{ erro?: string; verificarEmail?: boolean }> {
  const nomeEmpresa = String(formData.get("nomeEmpresa") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nomeEmpresa || !email || !password) {
    return { erro: "Preencha nome da empresa, email e password." };
  }
  if (password.length < 6) {
    return { erro: "A password tem de ter pelo menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { erro: error.message === "User already registered" ? "Já existe uma conta com este email." : "Não foi possível criar a conta." };
  }

  // Sem sessão imediata = confirmação de email ativa no projeto Supabase;
  // a empresa só pode ser criada (RLS exige auth.uid()) depois do primeiro
  // login já autenticado — ver /signup/completar.
  if (!data.session) {
    return { verificarEmail: true };
  }

  const { error: erroEmpresa } = await supabase
    .from("companies")
    .insert({ nome: nomeEmpresa, user_id: data.user!.id });

  if (erroEmpresa) {
    return { erro: "Conta criada, mas houve um erro a criar a empresa. Volte a entrar." };
  }

  redirect("/dashboard");
}
