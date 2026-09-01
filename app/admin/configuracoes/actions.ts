"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function guardarConfiguracoes(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  const followup_dias_default = Number(formData.get("followup_dias_default") || 3);
  if (!Number.isFinite(followup_dias_default) || followup_dias_default < 0) {
    throw new Error("Os dias de follow-up têm de ser um número igual ou superior a 0.");
  }

  const valor_mao_obra_primeira_hora = Number(formData.get("valor_mao_obra_primeira_hora") || 0);
  const valor_mao_obra_hora_adicional = Number(formData.get("valor_mao_obra_hora_adicional") || 0);
  const valor_mao_obra_dia_completo = Number(formData.get("valor_mao_obra_dia_completo") || 0);
  const valor_mao_obra_2_dias = Number(formData.get("valor_mao_obra_2_dias") || 0);
  const valor_mao_obra_visita_orcamento = Number(formData.get("valor_mao_obra_visita_orcamento") || 0);
  const valor_mao_obra_taxa_deslocacao = Number(formData.get("valor_mao_obra_taxa_deslocacao") || 0);
  for (const [campo, valor] of [
    ["Visita para Orçamento", valor_mao_obra_visita_orcamento],
    ["Taxa de Deslocação", valor_mao_obra_taxa_deslocacao],
    ["1ª hora", valor_mao_obra_primeira_hora],
    ["hora adicional", valor_mao_obra_hora_adicional],
    ["dia completo", valor_mao_obra_dia_completo],
    ["2 dias completos", valor_mao_obra_2_dias],
  ] as const) {
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error(`O preço da mão de obra (${campo}) tem de ser um número igual ou superior a 0.`);
    }
  }

  await supabase
    .from("org_settings")
    .update({
      followup_dias_default,
      valor_mao_obra_primeira_hora,
      valor_mao_obra_hora_adicional,
      valor_mao_obra_dia_completo,
      valor_mao_obra_2_dias,
      valor_mao_obra_visita_orcamento,
      valor_mao_obra_taxa_deslocacao,
    })
    .eq("organization_id", organizationId);

  revalidatePath("/admin/configuracoes");
}
