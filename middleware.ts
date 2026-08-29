import { NextResponse, type NextRequest } from "next/server";

// Esta é a primeira barreira de acessos: corre no servidor, antes de qualquer
// página ser renderizada. Um utilizador sem sessão nunca chega a ver o código
// de nenhuma página protegida — é redirecionado aqui.
//
// Nota importante: o middleware corre em Edge Runtime, que nesta (e noutras)
// máquinas pode não conseguir fazer pedidos de rede (ex: antivírus/firewall a
// interferir com TLS do sandbox — sintoma: erros "fetch failed"). Até usar
// getSession() do @supabase/ssr, que por vezes tenta renovar o token via
// rede, causava um ciclo de redirecionamentos porque a sessão ficava
// inconsistente entre pedidos. Por isso aqui só verificamos se existe a
// cookie de sessão (sem SDK, sem rede) — é uma verificação de conveniência.
// A validação real da sessão (getUser) e da role (tabela profiles) foi
// movida para os layouts de cada área (app/admin, app/super-admin,
// app/tecnico), que correm em Node.js normal, onde a rede funciona. A
// proteção real dos dados continua a ser sempre a RLS da base de dados.
function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  // /esqueci-password e /redefinir-password também têm de ficar acessíveis
  // sem sessão — em particular /redefinir-password: o link do email só cria
  // a sessão de recuperação depois do JS da página correr no browser, por
  // isso o primeiro pedido a chegar aqui ainda não tem cookie nenhum. Se
  // fosse tratada como rota protegida normal, o middleware mandava logo para
  // /login e perdia-se o código de recuperação que vinha no URL.
  const isPublicAuthRoute = isAuthRoute || path.startsWith("/esqueci-password") || path.startsWith("/redefinir-password");
  const hasSession = hasSessionCookie(request);

  if (!hasSession && !isPublicAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // /api/* fica de fora deste portão: são pedidos servidor-a-servidor (ex:
  // webhook/cron da sincronização do Google Sheets, sem cookies nenhuns) ou
  // rotas que tratam a sua própria autenticação (ex: requireRole() dentro do
  // callback OAuth) — nunca a gate de sessão-por-cookie feita aqui.
  // sw.js/manifest.json ficam de fora também: são pedidos estáticos feitos
  // pelo próprio browser (registo do service worker, "adicionar ao ecrã
  // principal") antes de sequer existir sessão — sem esta exceção o
  // middleware respondia com um redirect para /login em vez do ficheiro,
  // partindo silenciosamente as notificações push.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
