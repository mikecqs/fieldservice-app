import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireRole, getOrgId } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, fetchGoogleUserEmail } from "@/lib/google-sheets/sheets-api";
import { buildCompanySpreadsheet } from "@/lib/google-sheets/build";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "SUPER_ADMIN"]);
  const organizationId = await getOrgId();
  const url = new URL(request.url);
  const fail = (msg: string) =>
    NextResponse.redirect(`${url.origin}/admin/configuracoes?sheets_erro=${encodeURIComponent(msg)}`);

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (error) return fail("Autorização cancelada.");
  if (!code || !state) return fail("Pedido de autorização inválido.");

  let parsed: { organizationId: string; nonce: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return fail("Estado de autorização inválido.");
  }

  const nonceCookie = (await cookies()).get("google_sheets_oauth_nonce")?.value;
  (await cookies()).delete("google_sheets_oauth_nonce");
  if (!nonceCookie || nonceCookie !== parsed.nonce || parsed.organizationId !== organizationId) {
    return fail("Não foi possível confirmar o pedido de autorização.");
  }

  try {
    const redirectUri = `${url.origin}/api/integrations/google-sheets/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      return fail(
        "A Google não devolveu uma autorização de longa duração. Remove o acesso da app em myaccount.google.com/permissions e tenta ligar novamente."
      );
    }
    const email = await fetchGoogleUserEmail(tokens.access_token);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();
    const { data: org } = await admin.from("organizations").select("nome").eq("id", organizationId).single();

    const { spreadsheetId, spreadsheetUrl } = await buildCompanySpreadsheet(
      admin,
      tokens.access_token,
      organizationId,
      org?.nome ?? "Empresa"
    );

    await admin.from("google_sheets_integrations").upsert({
      organization_id: organizationId,
      status: "ativo",
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl,
      google_email: email,
      refresh_token: tokens.refresh_token,
      connected_by: user?.id ?? null,
      last_error: null,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.redirect(`${url.origin}/admin/configuracoes?sheets=conectado`);
  } catch (err: any) {
    return fail(err.message || "Não foi possível criar o Google Sheet.");
  }
}
