"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function marcarFaturado(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get("id") || "");
  const faturacao_valor = Number(formData.get("faturacao_valor") || 0);
  const faturacao_referencia = String(formData.get("faturacao_referencia") || "");
  if (!id) return;

  await supabase
    .from("services")
    .update({
      faturacao_estado: "faturado",
      faturacao_valor,
      faturacao_referencia,
      faturacao_data: new Date().toISOString().slice(0, 10),
      faturacao_utilizador: user!.id,
    })
    .eq("id", id);

  revalidatePath("/admin/faturacao");
}

// O técnico nunca chega a estas duas ações: não tem UPDATE em `services`
// nem policy em `service_validations` — só o Admin (via RLS) consegue
// validar ou rejeitar. Cada ação fica sempre registada no histórico,
// mesmo que a mesma OS seja corrigida e reavaliada várias vezes.
export async function validarServico(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get("id") || "");
  if (!id) return;

  await supabase.from("services").update({ estado: "concluido" }).eq("id", id);
  await supabase.from("service_validations").insert({
    organization_id: organizationId,
    service_id: id,
    acao: "validado",
    utilizador: user!.id,
  });

  revalidatePath("/admin/faturacao");
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/atencao");
}

export async function enviarParaCorrecao(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get("id") || "");
  const motivo = String(formData.get("motivo") || "").trim();
  if (!id || !motivo) return;

  await supabase.from("services").update({ estado: "correcao_necessaria" }).eq("id", id);
  await supabase.from("service_validations").insert({
    organization_id: organizationId,
    service_id: id,
    acao: "rejeitado",
    motivo,
    utilizador: user!.id,
  });

  revalidatePath("/admin/faturacao");
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/atencao");
  revalidatePath("/tecnico");
}
