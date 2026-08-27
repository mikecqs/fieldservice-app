"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export async function criarServico(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  const client_id = String(formData.get("client_id") || "");
  const address_id = String(formData.get("address_id") || "") || null;
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "");
  const prioridade = String(formData.get("prioridade") || "normal");
  const valor = Number(formData.get("valor") || 0);

  if (!client_id || !tipo || !descricao) return;

  const { data: service, error } = await supabase
    .from("services")
    .insert({ organization_id: organizationId, client_id, address_id, tipo, descricao, prioridade, valor })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar o serviço.");

  revalidatePath("/admin/servicos");
  redirect(`/admin/servicos/${service.id}`);
}

export async function atualizarAgendamento(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const data_agendada = String(formData.get("data_agendada") || "") || null;
  const hora_agendada = String(formData.get("hora_agendada") || "") || null;
  const prioridade = String(formData.get("prioridade") || "normal");
  const notas = String(formData.get("notas") || "");

  const update: Record<string, unknown> = { data_agendada, hora_agendada, prioridade, notas };
  const { data: current } = await supabase.from("services").select("estado").eq("id", id).single();
  if (data_agendada && current?.estado === "por_agendar") update.estado = "agendado";

  await supabase.from("services").update(update).eq("id", id);
  revalidatePath(`/admin/servicos/${id}`);
}

export async function mudarEstado(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "");
  if (!id || !estado) return;
  await supabase.from("services").update({ estado }).eq("id", id);
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath("/admin/servicos");
}

export async function atribuirTecnico(formData: FormData) {
  const supabase = createClient();
  const service_id = String(formData.get("service_id") || "");
  const user_id = String(formData.get("user_id") || "");
  if (!service_id || !user_id) return;
  await supabase.from("service_technicians").insert({ service_id, user_id });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerTecnico(formData: FormData) {
  const supabase = createClient();
  const service_id = String(formData.get("service_id") || "");
  const user_id = String(formData.get("user_id") || "");
  if (!service_id || !user_id) return;
  await supabase.from("service_technicians").delete().eq("service_id", service_id).eq("user_id", user_id);
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function adicionarMaterialPlaneado(formData: FormData) {
  const supabase = createClient();
  const service_id = String(formData.get("service_id") || "");
  const nome = String(formData.get("nome") || "");
  const qtd = Number(formData.get("qtd") || 1);
  if (!service_id || !nome) return;
  await supabase.from("service_materials_planned").insert({ service_id, nome, qtd });
  revalidatePath(`/admin/servicos/${service_id}`);
}

export async function removerMaterialPlaneado(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const service_id = String(formData.get("service_id") || "");
  if (!id) return;
  await supabase.from("service_materials_planned").delete().eq("id", id);
  revalidatePath(`/admin/servicos/${service_id}`);
}
