import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Rota de callback dos emails do Supabase Auth (recuperação de password,
// e no futuro confirmação de email se "Confirm email" estiver ligado) —
// segue o padrão oficial documentado pelo Supabase para apps Next.js com
// @supabase/ssr: o link do email aponta para aqui com token_hash+type,
// isto troca o token por uma sessão real (cookies HttpOnly) e só depois
// redireciona para a página seguinte.
//
// Fica deliberadamente em app/api/* — já excluído do portão de sessão do
// middleware.ts (matcher ignora "api/"), que é exatamente o que esta rota
// precisa: tem de ser acessível sem sessão nenhuma, é ela que cria a
// sessão.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/esqueci-password?erro=link_invalido`);
}
