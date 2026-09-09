import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  user_id: string;
  nome: string;
  nif: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  logo_path: string | null;
  condicoes_padrao: string | null;
  created_at: string;
};

// Middleware já garante que existe sessão nas rotas protegidas — esta função
// só liga essa sessão à respetiva empresa (1 conta = 1 empresa). Se a
// empresa ainda não existir (falha rara: signup criou o utilizador mas não
// chegou a criar a linha em `companies`), manda para /signup/completar em
// vez de deixar as páginas rebentar com dados em falta.
export async function requireCompany(): Promise<Company> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/signup/completar");
  }

  return company as Company;
}
