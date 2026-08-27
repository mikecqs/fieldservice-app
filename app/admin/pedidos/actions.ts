"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function criarPedido(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  const client_id = String(formData.get("client_id") || "");
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "");
  const origem = String(formData.get("origem") || "");
  const info_falta = formData.get("info_falta") === "on";

  if (!client_id || !tipo || !descricao) return;

  const { error } = await supabase.from("requests").insert({
    organization_id: organizationId,
    client_id,
    tipo,
    descricao,
    origem,
    info_falta,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/pedidos");
  redirect("/admin/pedidos");
}

// Deixa o Admin acrescentar a informação que faltava ao pedido e limpa o
// alerta (info_falta) — é o que faz o pedido sair de "Atenção".
export async function resolverInfoPedido(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const infoAdicional = String(formData.get("info_adicional") || "").trim();
  if (!id) return;

  const update: Record<string, unknown> = { info_falta: false };
  if (infoAdicional) {
    const { data: pedido } = await supabase.from("requests").select("descricao").eq("id", id).single();
    update.descricao = pedido?.descricao ? `${pedido.descricao}\n\n${infoAdicional}` : infoAdicional;
  }

  await supabase.from("requests").update(update).eq("id", id);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/atencao");
}

export async function arquivarPedido(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase.from("requests").update({ estado: "arquivado" }).eq("id", id);
  revalidatePath("/admin/pedidos");
}

// Cria um orçamento em rascunho a partir de um pedido, e manda o Admin
// diretamente para lá para preencher as linhas de orçamento.
export async function converterEmOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const requestId = String(formData.get("id") || "");
  const clientId = String(formData.get("client_id") || "");
  if (!requestId || !clientId) return;

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({ organization_id: organizationId, client_id: clientId, request_id: requestId })
    .select()
    .single();
  if (error || !budget) throw new Error(error?.message || "Não foi possível criar o orçamento.");

  await supabase.from("requests").update({ estado: "orcamento" }).eq("id", requestId);

  revalidatePath("/admin/pedidos");
  redirect(`/admin/orcamentos/${budget.id}`);
}
