import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./lib/supabase/env";

const emDesenvolvimento = process.env.NODE_ENV !== "production";

// CSP construída a partir do que a app realmente usa — auditado no
// código, não copiada de um exemplo genérico.
//
// script-src precisa de 'unsafe-inline', e isto foi uma correção feita
// depois de testar visualmente, não só em teoria: uma primeira versão
// desta CSP usava `script-src 'self'` estrito (e depois uma variante com
// nonce + 'strict-dynamic'), e ambas deixaram o ecrã de login
// completamente em branco/preto — o Next.js App Router injeta os seus
// próprios <script> inline na HTML para hidratar a página (o payload de
// RSC, `self.__next_f.push(...)`), e esses scripts NÃO recebem
// automaticamente um nonce (confirmado: é uma limitação conhecida e
// ainda em aberto do próprio Next.js, não um erro de configuração desta
// app — https://github.com/vercel/next.js/issues/63749). Sem
// 'unsafe-inline', esses scripts ficam bloqueados e a página nunca
// hidrata. A proteção real desta CSP contra XSS fica então em não haver
// nenhum `dangerouslySetInnerHTML` em lado nenhum do código (confirmado
// por grep) — o vetor que 'unsafe-inline' abriria (injeção de HTML com
// um <script> embutido) já não existe nesta app por outra via; o
// `frame-ancestors 'none'` abaixo (proteção contra clickjacking, o
// achado original da auditoria) continua totalmente ativo.
function contentSecurityPolicy(): string {
  const scriptSrc = emDesenvolvimento ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
  const connectSrc = emDesenvolvimento ? "'self' ws://localhost:* http://localhost:*" : "'self'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // Domínio do Supabase Storage: o logotipo da empresa é servido via
    // signed URL para https://<projeto>.supabase.co/storage/v1/... .
    "img-src 'self' https://*.supabase.co",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

const csp = contentSecurityPolicy();

// Portão de sessão: sem utilizador autenticado, só /login e /signup são
// acessíveis. Mesmo padrão do fieldservice-app, sem a lógica de domínio
// (este projeto não tem landing institucional nem múltiplos domínios).
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  response.headers.set("Content-Security-Policy", csp);

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
          response.headers.set("Content-Security-Policy", csp);
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
