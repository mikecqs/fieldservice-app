import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Esta é a primeira barreira de acessos: corre no servidor, antes de qualquer
// página ser renderizada. Um utilizador sem sessão válida nunca chega a ver
// o código de nenhuma página protegida — é redirecionado aqui.
//
// Cria o cliente Supabase SSR e chama getUser() aqui mesmo, no middleware —
// é o único sítio do pipeline do Next.js App Router onde ler *e* escrever
// cookies em todos os pedidos é garantido (Server Components só podem ler;
// Server Actions/Route Handlers só escrevem quando chamados explicitamente).
// getUser() valida sempre contra o servidor do Supabase (nunca confia só no
// conteúdo da cookie) e é também isto que despoleta a renovação do access
// token quando expirou — com as cookies novas já escritas na resposta pelo
// setAll abaixo, nunca só em memória.
//
// Antes disto, o middleware só verificava se a cookie de sessão existia
// (sem validar nem renovar nada) — a única renovação possível ficava a
// cargo de requireRole()/getOrgId() (lib/auth.ts), chamados a partir de
// Server Components (layouts), onde a escrita de cookies é silenciosamente
// descartada (lib/supabase/server.ts). O refresh token acabava por rodar em
// memória sem nunca ser persistido no browser; na renovação seguinte o
// Supabase detetava reutilização do token antigo e revogava a sessão
// inteira — mas a cookie inválida continuava no browser, e o próprio
// middleware bloqueava o acesso a /login só por essa cookie "existir",
// prendendo o utilizador até limpar as cookies manualmente.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Espelha as cookies renovadas no request (para o resto deste
          // pedido as ver já atualizadas) e reconstrói a response a partir
          // desse request atualizado, antes de lhe aplicar as mesmas
          // cookies — é o padrão oficial do @supabase/ssr para middleware.
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
  const isAuthRoute = path.startsWith("/login");
  // /esqueci-password e /redefinir-password também têm de ficar acessíveis
  // sem sessão — em particular /redefinir-password: o link do email só cria
  // a sessão de recuperação depois do JS da página correr no browser, por
  // isso o primeiro pedido a chegar aqui ainda não tem cookie nenhuma. Se
  // fosse tratada como rota protegida normal, o middleware mandava logo
  // para /login e perdia-se o código de recuperação que vinha no URL.
  const isPublicAuthRoute = isAuthRoute || path.startsWith("/esqueci-password") || path.startsWith("/redefinir-password");

  if (!user && !isPublicAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // `user` vem sempre de getUser() (validado), nunca só da cookie existir —
  // por isso uma cookie antiga/inválida nunca impede o acesso a /login.
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // /api/* fica de fora deste portão: são pedidos servidor-a-servidor (ex:
  // webhook/cron da sincronização do Google Sheets, sem cookies nenhuns) ou
  // rotas que tratam a sua própria autenticação (ex: requireRole() dentro do
  // callback OAuth) — nunca a gate de sessão feita aqui.
  // sw.js/manifest.json ficam de fora também: são pedidos estáticos feitos
  // pelo próprio browser (registo do service worker, "adicionar ao ecrã
  // principal") antes de sequer existir sessão — sem esta exceção o
  // middleware respondia com um redirect para /login em vez do ficheiro,
  // partindo silenciosamente as notificações push.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
