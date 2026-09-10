"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { LIMITE_MODELOS } from "./constantes";

async function buscarModeloDaEmpresa(templateId: string, companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budget_templates")
    .select("id")
    .eq("id", templateId)
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

export async function criarModelo(formData: FormData): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    return { erro: "Indique um nome para o modelo." };
  }

  const { count } = await supabase
    .from("budget_templates")
    .select("id", { count: "exact", head: true })
    .eq("company_id", empresa.id);

  if ((count ?? 0) >= LIMITE_MODELOS) {
    return { erro: `Já tem ${LIMITE_MODELOS} modelos — apague um antes de criar outro.` };
  }

  const { data: modelo, error } = await supabase
    .from("budget_templates")
    .insert({
      company_id: empresa.id,
      nome,
      condicoes: empresa.condicoes_padrao ?? null,
      iva_percent: 23,
      validade_dias: 30,
    })
    .select("id")
    .single();

  if (error || !modelo) {
    return { erro: "Não foi possível criar o modelo." };
  }

  redirect(`/empresa/modelos/${modelo.id}`);
}

export async function atualizarModelo(templateId: string, formData: FormData): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    return { erro: "Indique um nome para o modelo." };
  }

  const { error } = await supabase
    .from("budget_templates")
    .update({
      nome,
      condicoes: String(formData.get("condicoes") ?? "").trim() || null,
      iva_percent: Number(formData.get("ivaPercent") ?? 23),
      validade_dias: Number(formData.get("validadeDias") ?? 30),
    })
    .eq("id", templateId)
    .eq("company_id", empresa.id);

  if (error) {
    return { erro: "Não foi possível guardar as alterações." };
  }

  revalidatePath(`/empresa/modelos/${templateId}`);
  revalidatePath("/empresa");
  return {};
}

export async function apagarModelo(templateId: string): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { error } = await supabase
    .from("budget_templates")
    .delete()
    .eq("id", templateId)
    .eq("company_id", empresa.id);

  if (error) {
    return { erro: "Não foi possível apagar o modelo." };
  }

  revalidatePath("/empresa");
  redirect("/empresa");
}

export async function adicionarItemModelo(templateId: string, formData: FormData): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const modelo = await buscarModeloDaEmpresa(templateId, empresa.id);
  if (!modelo) {
    return { erro: "Modelo não encontrado." };
  }

  const descricao = String(formData.get("descricao") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 1);
  const valorUnitario = Number(formData.get("valorUnitario") ?? 0);

  if (!descricao || !Number.isFinite(quantidade) || !Number.isFinite(valorUnitario)) {
    return { erro: "Preencha a descrição, quantidade e valor do item." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budget_template_items").insert({
    template_id: templateId,
    descricao,
    quantidade,
    valor_unitario: valorUnitario,
  });

  if (error) {
    return { erro: "Não foi possível adicionar o item." };
  }

  revalidatePath(`/empresa/modelos/${templateId}`);
  return {};
}

export async function removerItemModelo(templateId: string, itemId: string): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const modelo = await buscarModeloDaEmpresa(templateId, empresa.id);
  if (!modelo) {
    return { erro: "Modelo não encontrado." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_template_items")
    .delete()
    .eq("id", itemId)
    .eq("template_id", templateId);

  if (error) {
    return { erro: "Não foi possível remover o item." };
  }

  revalidatePath(`/empresa/modelos/${templateId}`);
  return {};
}
