"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function criarCompra(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  const descricao = String(formData.get("descricao") || "");
  const fornecedor = String(formData.get("fornecedor") || "");
  const data_prevista = String(formData.get("data_prevista") || "") || null;
  const service_id = String(formData.get("service_id") || "") || null;
  const nomes = formData.getAll("item_nome") as string[];
  const qtds = formData.getAll("item_qtd") as string[];

  if (!descricao) return;

  const { data: compra, error } = await supabase
    .from("purchases")
    .insert({ organization_id: organizationId, descricao, fornecedor, data_prevista, service_id })
    .select()
    .single();
  if (error || !compra) throw new Error(error?.message || "Não foi possível criar a compra.");

  const items = nomes
    .map((nome, i) => ({ purchase_id: compra.id, nome: nome.trim(), qtd: Number(qtds[i] || 1) }))
    .filter((i) => i.nome);
  if (items.length > 0) {
    await supabase.from("purchase_items").insert(items);
  }

  revalidatePath("/admin/compras");
  redirect("/admin/compras");
}

export async function avancarEstadoCompra(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "");
  if (!id || !estado) return;
  await supabase.from("purchases").update({ estado }).eq("id", id);
  revalidatePath("/admin/compras");
}

// Atalho usado a partir da página de Materiais: cria uma compra já com um
// único item, para um material planeado que ainda não tem compra associada.
export async function criarCompraRapida(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const nome = String(formData.get("nome") || "");
  const qtd = Number(formData.get("qtd") || 1);
  const service_id = String(formData.get("service_id") || "") || null;
  if (!nome) return;

  const { data: compra, error } = await supabase
    .from("purchases")
    .insert({ organization_id: organizationId, descricao: nome, service_id })
    .select()
    .single();
  if (error || !compra) throw new Error(error?.message || "Não foi possível criar a compra.");

  await supabase.from("purchase_items").insert({ purchase_id: compra.id, nome, qtd });

  revalidatePath("/admin/materiais");
  revalidatePath("/admin/compras");
}
