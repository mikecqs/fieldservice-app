import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./lib/supabase/env";

// Portão de sessão: sem utilizador autenticado, só /login e /signup são
// acessíveis. Mesmo padrão do fieldservice-app, sem a lógica de domínio
// (este projeto não tem landing institucional nem múltiplos domínios).
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as CookieOptions)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Só /login e /signup (exatos) são acessíveis sem sessão e redirecionam
  // para /dashboard se já houver sessão. /signup/completar exige sessão
  // (falta só criar a empresa) mas nunca é tratada como rota "pública de
  // auth" — senão um utilizador autenticado sem empresa ainda ficava num
  // ciclo /dashboard → (sem empresa) → /signup/completar → (tem sessão) →
  // /dashboard.
  const isExactPublicAuthRoute = path === "/login" || path === "/signup";

  // /esqueci-password (pedir o link) e /reset-password (definir a nova
  // password depois de clicar no link) nunca redirecionam por terem ou
  // não sessão: a primeira tem de funcionar tanto para quem está como
  // para quem não está autenticado (pode querer mudar a password mesmo
  // com sessão ativa); a segunda só resolve se ter sessão ou não sozinha
  // — quem não tiver (link inválido/expirado) fica na própria página, que
  // já mostra o estado certo (ver app/reset-password/page.tsx), nunca
  // atirado para /login sem explicação.
  const rotaDeRecuperacaoPassword = path === "/esqueci-password" || path === "/reset-password";

  if (!user && !isExactPublicAuthRoute && !rotaDeRecuperacaoPassword) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isExactPublicAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
