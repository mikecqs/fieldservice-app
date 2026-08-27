"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";

export async function criarOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return;

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({ organization_id: organizationId, client_id })
    .select()
    .single();
  if (error || !budget) throw new Error(error?.message || "Não foi possível criar o orçamento.");

  redirect(`/admin/orcamentos/${budget.id}`);
}

export async function adicionarItem(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const budget_id = String(formData.get("budget_id") || "");
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "");
  const qtd = Number(formData.get("qtd") || 1);
  const valor_unit = Number(formData.get("valor_unit") || 0);
  if (!budget_id || !descricao) return;

  await supabase.from("budget_items").insert({
    organization_id: organizationId,
    budget_id,
    tipo,
    descricao,
    qtd,
    valor_unit,
  });

  revalidatePath(`/admin/orcamentos/${budget_id}`);
}

export async function removerItem(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const budget_id = String(formData.get("budget_id") || "");
  if (!id) return;
  await supabase.from("budget_items").delete().eq("id", id);
  revalidatePath(`/admin/orcamentos/${budget_id}`);
}

export async function atualizarIva(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const iva_percent = Number(formData.get("iva_percent") || 0);
  if (!id || iva_percent < 0) return;
  await supabase.from("budgets").update({ iva_percent }).eq("id", id);
  revalidatePath(`/admin/orcamentos/${id}`);
}

export async function marcarEnviado(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase
    .from("budgets")
    .update({ estado: "enviado", enviado_em: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
}

export async function avancarEstado(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "");
  if (!id || !estado) return;
  await supabase.from("budgets").update({ estado }).eq("id", id);
  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
}

// Aceitar um orçamento cria o serviço correspondente com o valor TOTAL
// (com IVA incluído) — é esse o valor que fica associado ao serviço e que
// depois flui para a faturação, usando sempre calcularOrcamento() como
// única fonte da conta, para nunca haver dois cálculos diferentes do mesmo
// orçamento.
export async function aceitarOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: budget } = await supabase
    .from("budgets")
    .select("*, budget_items(*), requests(tipo, descricao, client_id)")
    .eq("id", id)
    .single();
  if (!budget) return;

  const { total: valor } = calcularOrcamento(budget.budget_items ?? [], budget.iva_percent);

  const { data: service, error } = await supabase
    .from("services")
    .insert({
      organization_id: organizationId,
      client_id: budget.client_id,
      request_id: budget.request_id,
      budget_id: budget.id,
      tipo: budget.requests?.tipo || "Serviço",
      descricao: budget.requests?.descricao || `Orçamento aceite`,
      valor,
    })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar o serviço.");

  await supabase.from("budgets").update({ estado: "aceite", service_id: service.id }).eq("id", id);
  if (budget.request_id) {
    await supabase.from("requests").update({ estado: "convertido" }).eq("id", budget.request_id);
  }

  revalidatePath("/admin/orcamentos");
  redirect(`/admin/servicos/${service.id}`);
}
