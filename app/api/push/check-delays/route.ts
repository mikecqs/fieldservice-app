import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

// Chamado a cada minuto pelo pg_cron (ver supabase/schema.sql) — nunca pelo
// browser. Verifica, para cada técnico atualmente num serviço em curso, se
// o próximo serviço agendado para hoje está em risco de atraso (mesmo
// critério já usado no aviso dentro da app: ≤ 30 min e ainda em curso) e
// envia um Web Push. Nunca repete: a chave primária de
// tech_delay_notifications garante uma única notificação por serviço.
export async function POST(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (!process.env.PUSH_CHECK_SECRET || secret !== process.env.PUSH_CHECK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return NextResponse.json({ error: "Web Push não configurado (faltam VAPID env vars)." }, { status: 500 });
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const admin = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const agora = new Date();

  const { data: emCursoRows } = await admin
    .from("services")
    .select("id, hora_agendada, service_technicians(user_id)")
    .eq("estado", "em_curso");

  let notificados = 0;

  for (const atual of emCursoRows ?? []) {
    for (const t of (atual as any).service_technicians ?? []) {
      const userId = t.user_id as string;

      const { data: agendados } = await admin
        .from("services")
        .select("id, hora_agendada, service_technicians!inner(user_id)")
        .eq("estado", "agendado")
        .eq("data_agendada", hoje)
        .eq("service_technicians.user_id", userId)
        .order("hora_agendada", { ascending: true });

      const proximo = (agendados ?? []).find(
        (s: any) => s.hora_agendada && (!atual.hora_agendada || s.hora_agendada > atual.hora_agendada)
      ) as any;
      if (!proximo?.hora_agendada) continue;

      const [h, m] = proximo.hora_agendada.split(":").map(Number);
      const previsto = new Date();
      previsto.setHours(h, m, 0, 0);
      const minutosPara = (previsto.getTime() - agora.getTime()) / 60000;
      if (minutosPara > 30) continue;

      // Insere primeiro (chave primária = guarda atómica contra duplicados):
      // se já existir, o insert falha e saltamos — nunca notifica duas vezes
      // o mesmo serviço, mesmo com cron a correr todos os minutos.
      const { data: inserted, error: insertErr } = await admin
        .from("tech_delay_notifications")
        .insert({ service_id: proximo.id })
        .select()
        .maybeSingle();
      if (insertErr || !inserted) continue;

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId);

      const payload = JSON.stringify({
        title: "⚠️ Risco de atraso",
        body: `O teu próximo serviço começa às ${proximo.hora_agendada.slice(0, 5)} e ainda estás no serviço atual.`,
        url: `/tecnico/servico/${proximo.id}`,
        tag: `atraso-${proximo.id}`,
      });

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }

      notificados++;
    }
  }

  return NextResponse.json({ notificados });
}
