"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { TAMANHO_MAXIMO_LOGO, detetarTipoImagem } from "@/lib/logo-validacao";

export async function guardarDadosEmpresa(formData: FormData): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    return { erro: "O nome da empresa é obrigatório." };
  }

  const followupDiasPadrao = Number(formData.get("followupDiasPadrao") ?? 7);
  if (!Number.isFinite(followupDiasPadrao) || followupDiasPadrao < 1) {
    return { erro: "Os dias de follow-up têm de ser um número positivo." };
  }

  const { error } = await supabase
    .from("companies")
    .update({
      nome,
      nif: String(formData.get("nif") ?? "").trim() || null,
      endereco: String(formData.get("endereco") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      condicoes_padrao: String(formData.get("condicoesPadrao") ?? "").trim() || null,
      followup_dias_padrao: Math.round(followupDiasPadrao),
    })
    .eq("id", empresa.id);

  if (error) {
    return { erro: "Não foi possível guardar os dados da empresa." };
  }

  revalidatePath("/empresa");
  return {};
}

export async function guardarLogotipo(formData: FormData): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return { erro: "Escolha um ficheiro de imagem." };
  }
  if (file.size > TAMANHO_MAXIMO_LOGO) {
    return { erro: "O logotipo não pode exceder 2MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipoDetetado = detetarTipoImagem(bytes);
  if (!tipoDetetado) {
    return { erro: "O logotipo tem de ser um PNG ou JPEG válido." };
  }

  const contentType = tipoDetetado === "png" ? "image/png" : "image/jpeg";
  const path = `${empresa.id}/logo.${tipoDetetado}`;

  if (empresa.logo_path && empresa.logo_path !== path) {
    await supabase.storage.from("logos").remove([empresa.logo_path]);
  }

  const { error: erroUpload } = await supabase.storage
    .from("logos")
    .upload(path, bytes, { upsert: true, contentType });

  if (erroUpload) {
    return { erro: "Não foi possível carregar o logotipo." };
  }

  const { error: erroUpdate } = await supabase
    .from("companies")
    .update({ logo_path: path })
    .eq("id", empresa.id);

  if (erroUpdate) {
    return { erro: "Não foi possível guardar o logotipo." };
  }

  revalidatePath("/empresa");
  return {};
}

export async function removerLogotipo(): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  if (empresa.logo_path) {
    await supabase.storage.from("logos").remove([empresa.logo_path]);
  }

  const { error } = await supabase.from("companies").update({ logo_path: null }).eq("id", empresa.id);
  if (error) {
    return { erro: "Não foi possível remover o logotipo." };
  }

  revalidatePath("/empresa");
  return {};
}
