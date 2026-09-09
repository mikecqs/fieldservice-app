"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";

export async function guardarDadosEmpresa(formData: FormData): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    return { erro: "O nome da empresa é obrigatório." };
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
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    return { erro: "O logotipo tem de ser PNG ou JPEG." };
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${empresa.id}/logo.${ext}`;

  if (empresa.logo_path && empresa.logo_path !== path) {
    await supabase.storage.from("logos").remove([empresa.logo_path]);
  }

  const { error: erroUpload } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });

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
