import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { processOrgQueue } from "@/lib/google-sheets/process-queue";

// Chamado de duas formas:
// 1. POST, quase em tempo real, pelo trigger da BD (pg_net) logo a seguir a
//    uma alteração — processa só a empresa indicada. Autenticado por um
//    segredo partilhado no cabeçalho (nunca pela sessão do utilizador, isto
//    não corre no contexto de ninguém autenticado).
// 2. GET, pelo Vercel Cron, como rede de segurança — varre todas as
//    empresas com integração ativa e processa o que tiver ficado pendente
//    (ex: se o pg_net falhou por instabilidade de rede). Autenticado pelo
//    cabeçalho Authorization que o próprio Vercel Cron injeta quando existe
//    a env var CRON_SECRET.
export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-sync-secret");
  if (!process.env.SHEETS_SYNC_SECRET || secretHeader !== process.env.SHEETS_SYNC_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as any));
  const organizationId = body.organization_id as string | undefined;
  if (!organizationId) return NextResponse.json({ error: "organization_id em falta" }, { status: 400 });

  const admin = createAdminClient();
  const result = await processOrgQueue(admin, organizationId);
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orgs } = await admin.from("google_sheets_integrations").select("organization_id").eq("status", "ativo");

  const results = [];
  for (const o of orgs ?? []) {
    results.push({ organizationId: o.organization_id, ...(await processOrgQueue(admin, o.organization_id)) });
  }
  return NextResponse.json({ organizacoes: results.length, results });
}
