"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";

// Única lógica que cria um orçamento a partir de um pedido — usada tanto
// quando o tipo já é "Orçamento" (automático, sem perguntar nada) como
// quando o Admin responde "Sim" à pergunta "é necessário orçamento?".
// O pedido fica sempre associado ao orçamento (request_id), e o próprio
// estado do pedido reflete o que aconteceu — nunca fica por atualizar à mão.
async function criarOrcamentoDePedido(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  requestId: string,
  clientId: string
) {
  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({ organization_id: organizationId, client_id: clientId, request_id: requestId })
    .select()
    .single();
  if (error || !budget) throw new Error(error?.message || "Não foi possível criar o orçamento.");

  await supabase.from("requests").update({ estado: "orcamento" }).eq("id", requestId);
  return budget;
}

export async function criarPedido(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();

  const client_id = String(formData.get("client_id") || "");
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "");
  const origem = String(formData.get("origem") || "");
  const info_falta = formData.get("info_falta") === "on";

  if (!client_id || !tipo || !descricao) return;

  const { data: pedido, error } = await supabase
    .from("requests")
    .insert({ organization_id: organizationId, client_id, tipo, descricao, origem, info_falta })
    .select()
    .single();
  if (error || !pedido) throw new Error(error?.message || "Não foi possível criar o pedido.");

  revalidatePath("/admin/pedidos");

  // Pedidos do tipo "Orçamento" seguem sempre para lá, sem perguntar nada.
  // Qualquer outro tipo (Manutenção, Instalação, ou outro configurado em
  // Configurações) pergunta primeiro se é necessário orçamento.
  if (tipo === "Orçamento") {
    const budget = await criarOrcamentoDePedido(supabase, organizationId, pedido.id, client_id);
    redirect(`/admin/orcamentos/${budget.id}`);
  }
  redirect(`/admin/pedidos/${pedido.id}/decisao`);
}

// Resposta "Sim" à pergunta "é necessário orçamento?".
export async function decidirComOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const requestId = String(formData.get("id") || "");
  const clientId = String(formData.get("client_id") || "");
  if (!requestId || !clientId) return;

  const budget = await criarOrcamentoDePedido(supabase, organizationId, requestId, clientId);
  revalidatePath("/admin/pedidos");
  redirect(`/admin/orcamentos/${budget.id}`);
}

// Resposta "Não" à pergunta "é necessário orçamento?" — cria logo o serviço
// (fica por agendar), sem passar por orçamento nenhum. O pedido continua
// associado ao serviço através de request_id.
export async function decidirSemOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const requestId = String(formData.get("id") || "");
  if (!requestId) return;

  const { data: pedido } = await supabase.from("requests").select("client_id, tipo, descricao").eq("id", requestId).single();
  if (!pedido) return;

  const { data: service, error } = await supabase
    .from("services")
    .insert({
      organization_id: organizationId,
      client_id: pedido.client_id,
      request_id: requestId,
      tipo: pedido.tipo,
      descricao: pedido.descricao,
    })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar o serviço.");

  await supabase.from("requests").update({ estado: "convertido" }).eq("id", requestId);

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: service.id,
    tipo: "criado",
    descricao: `Serviço criado a partir do pedido (${pedido.tipo}), sem orçamento.`,
  });

  revalidatePath("/admin/pedidos");
  redirect(`/admin/servicos/${service.id}`);
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

// Continua a existir para pedidos que ficaram parados em "novo" (ex: o
// Admin fechou o browser a meio da pergunta) — a lista de Pedidos ainda
// mostra este botão manual como rede de segurança.
export async function converterEmOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const requestId = String(formData.get("id") || "");
  const clientId = String(formData.get("client_id") || "");
  if (!requestId || !clientId) return;

  const budget = await criarOrcamentoDePedido(supabase, organizationId, requestId, clientId);
  revalidatePath("/admin/pedidos");
  redirect(`/admin/orcamentos/${budget.id}`);
}
