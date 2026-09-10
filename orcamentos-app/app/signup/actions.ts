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
    if (error.message === "User already registered") {
      return { erro: "Já existe uma conta com este email. Entre em /login." };
    }
    // Mostrar a mensagem real do Supabase em vez de um genérico "não foi
    // possível" — já perdemos tempo a adivinhar a causa de erros
    // parecidos (rate limit, domínio de email inválido, password fraca,
    // etc.) por esconder o texto original.
    return { erro: `Não foi possível criar a conta: ${error.message}` };
  }

  // O Supabase Auth nunca confirma explicitamente que o email já tinha
  // conta (proteção contra enumeração) — devolve sucesso "vazio"
  // (user.identities: []), sem sessão nem erro. Sem isto, um re-signup
  // com email já registado caía sempre na mensagem "verifique o email",
  // mesmo quando a verdadeira causa era outra (conta já existente).
  const contaJaExistia = (data.user?.identities?.length ?? 1) === 0;

  let session = data.session;

  // Com "Confirm email" desligado no projeto Supabase, o utilizador já
  // fica confirmado na hora, mas signUp() nem sempre devolve a sessão
  // diretamente nesse caso — um signIn explícito a seguir (já temos a
  // password em mãos, na mesma Server Action) resolve sem pedir nada
  // extra ao utilizador.
  if (!session) {
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
    session = signInData.session;
  }

  if (!session) {
    if (contaJaExistia) {
      return { erro: "Já existe uma conta com este email. Entre em /login." };
    }
    // Só chega aqui se a confirmação de email estiver mesmo ativa no
    // projeto — nesse caso é genuinamente preciso esperar pelo email.
    return { verificarEmail: true };
  }

  const { error: erroEmpresa } = await supabase
    .from("companies")
    .insert({ nome: nomeEmpresa, user_id: session.user.id });

  // 23505 = unique_violation — já existe uma empresa para este
  // utilizador (ex: voltou a submeter o formulário depois de já ter
  // conseguido criar a conta); não é um erro real, só avança.
  if (erroEmpresa && erroEmpresa.code !== "23505") {
    return { erro: "Conta criada, mas houve um erro a criar a empresa. Volte a entrar." };
  }

  redirect("/dashboard");
}
