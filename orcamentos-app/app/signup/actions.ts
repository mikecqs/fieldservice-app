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
  if (password.length < 8) {
    return { erro: "A password tem de ter pelo menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  // Nunca revelar, por nenhum caminho desta função, se o email já tinha
  // conta — só se mostram erros que não dependam de qual é o email (ex:
  // rate limit, formato inválido), nunca "já existe uma conta com este
  // email". Antes desta correção havia duas mensagens distintas
  // ("já existe conta" vs. "verifique o email") que permitiam a alguém
  // enumerar quais emails já estão registados só tentando o signup —
  // agora os dois casos são sempre indistinguíveis para quem preenche o
  // formulário (ver auditoria de segurança, VULN-02).
  if (error) {
    if (error.message === "User already registered") {
      return { verificarEmail: true };
    }
    return { erro: `Não foi possível criar a conta: ${error.message}` };
  }

  // O Supabase Auth nunca confirma explicitamente que o email já tinha
  // conta — devolve sucesso "vazio" (user.identities: []), sem sessão nem
  // erro, quando o email já existe.
  const contaJaExistia = (data.user?.identities?.length ?? 1) === 0;

  let session = data.session;

  // Com "Confirm email" desligado no projeto Supabase, o utilizador já
  // fica confirmado na hora, mas signUp() nem sempre devolve a sessão
  // diretamente nesse caso — um signIn explícito a seguir (já temos a
  // password em mãos, na mesma Server Action) resolve sem pedir nada
  // extra ao utilizador. Nunca tentado quando a conta já existia (não
  // temos a certeza de que a password introduzida é a da conta real).
  if (!session && !contaJaExistia) {
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
    session = signInData.session;
  }

  if (!session) {
    // Mesma mensagem quer a conta já existisse quer seja preciso
    // confirmar o email de uma conta nova — indistinguível de propósito.
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
