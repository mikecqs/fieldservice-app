"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function subscreverPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const supabase = createClient();
  const organizationId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sem sessão.");

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      organization_id: organizationId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );
}

export async function cancelarSubscricaoPush(endpoint: string) {
  const supabase = createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
