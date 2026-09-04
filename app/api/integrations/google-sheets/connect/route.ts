import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireRole, getOrgId } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/google-sheets/sheets-api";
import { appUrl } from "@/lib/app-url";

// Ponto de partida do "Ligar Google Sheets": nunca é chamado por script/API
// — só por um clique real do Admin, porque o próprio browser tem de seguir
// o redirect até à Google para o Admin autorizar com a conta que quiser.
export async function GET(request: Request) {
  await requireRole(["ADMIN", "SUPER_ADMIN"]);
  const organizationId = await getOrgId();
  // Auditoria de segurança — origem de confiança fixa (nunca derivada do
  // pedido) para nunca depender de um Host manipulado; tem também de bater
  // sempre certo com a mesma origem usada no callback (troca do código pela
  // Google exige o mesmo redirect_uri nos dois pedidos).
  const origin = appUrl();

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ organizationId, nonce })).toString("base64url");

  (await cookies()).set("google_sheets_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${origin}/api/integrations/google-sheets/callback`;
  try {
    return NextResponse.redirect(buildAuthUrl(redirectUri, state));
  } catch (err: any) {
    // Antes disto, uma variável de ambiente em falta (GOOGLE_SHEETS_CLIENT_ID/
    // SECRET) fazia esta rota rebentar com um 500 em branco, em vez de mostrar
    // o erro amigável que /admin/configuracoes já sabe apresentar.
    return NextResponse.redirect(
      `${origin}/admin/configuracoes?sheets_erro=${encodeURIComponent(err.message || "Não foi possível iniciar a ligação ao Google Sheets.")}`
    );
  }
}
