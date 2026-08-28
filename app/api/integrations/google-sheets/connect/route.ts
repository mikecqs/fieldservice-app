import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireRole, getOrgId } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/google-sheets/sheets-api";

// Ponto de partida do "Ligar Google Sheets": nunca é chamado por script/API
// — só por um clique real do Admin, porque o próprio browser tem de seguir
// o redirect até à Google para o Admin autorizar com a conta que quiser.
export async function GET(request: Request) {
  await requireRole(["ADMIN", "SUPER_ADMIN"]);
  const organizationId = await getOrgId();

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ organizationId, nonce })).toString("base64url");

  cookies().set("google_sheets_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${new URL(request.url).origin}/api/integrations/google-sheets/callback`;
  return NextResponse.redirect(buildAuthUrl(redirectUri, state));
}
