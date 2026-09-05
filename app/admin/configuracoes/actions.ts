"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getOrgId, getOrgIdAndRole } from "@/lib/auth";

export async function guardarConfiguracoes(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();

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

// Logotipo usado nos PDFs de orçamento/fecho de serviço (lib/pdf-fecho.ts,
// app/admin/orcamentos/[id]/pdf/route.ts) em vez do quadrado "nX" genérico.
// Só PNG/JPEG (pdf-lib só sabe embutir estes dois formatos), caminho sempre
// "{organization_id}/logo.<ext>" — nunca acumula ficheiros órfãos: remove o
// anterior primeiro se a extensão mudar (ex: trocou de .png para .jpg).
export async function guardarLogotipo(formData: FormData) {
  // O upload em si já fica bloqueado pela policy do Storage para quem não
  // for ADMIN/SUPER_ADMIN, mas o update a seguir usa createAdminClient()
  // (contorna RLS, ver comentário abaixo) — sem este check explícito, essa
  // escrita deixaria de ter qualquer gate de role.
  const { organizationId, role } = await getOrgIdAndRole();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Sem permissão para alterar o logotipo.");
  }
  const supabase = await createClient();
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    throw new Error("Escolhe um ficheiro de imagem.");
  }
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    throw new Error("O logotipo tem de ser PNG ou JPEG.");
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${organizationId}/logo.${ext}`;

  const { data: orgAtual } = await supabase.from("organizations").select("logo_path").eq("id", organizationId).single();
  if (orgAtual?.logo_path && orgAtual.logo_path !== path) {
    await supabase.storage.from("logos").remove([orgAtual.logo_path]);
  }

  const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw new Error(upErr.message);

  // organizations só tem policy de UPDATE para SUPER_ADMIN ("super admin
  // full access to organizations") — o ADMIN só tem SELECT ("members can
  // read own organization"). Sem createAdminClient() aqui, o upload do
  // ficheiro funcionava mas este update ficava silenciosamente sem efeito
  // (0 linhas afetadas, sem erro), e o logotipo nunca aparecia nos PDFs.
  // Filtra sempre por organizationId (nunca vindo do cliente) — só este
  // campo é escrito, nunca nome/nif/ativa.
  const admin = createAdminClient();
  await admin.from("organizations").update({ logo_path: path }).eq("id", organizationId);
  revalidatePath("/admin/configuracoes");
}

export async function removerLogotipo() {
  // Mesmo motivo do check em guardarLogotipo: a remoção do ficheiro no
  // Storage falhava silenciosamente para quem não fosse ADMIN/SUPER_ADMIN
  // (ignorado abaixo), mas sem este check o update via createAdminClient()
  // limpava `logo_path` na mesma, sem nenhum gate de role.
  const { organizationId, role } = await getOrgIdAndRole();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Sem permissão para remover o logotipo.");
  }
  const supabase = await createClient();
  const { data: orgAtual } = await supabase.from("organizations").select("logo_path").eq("id", organizationId).single();
  if (orgAtual?.logo_path) {
    await supabase.storage.from("logos").remove([orgAtual.logo_path]);
  }
  const admin = createAdminClient();
  await admin.from("organizations").update({ logo_path: null }).eq("id", organizationId);
  revalidatePath("/admin/configuracoes");
}
