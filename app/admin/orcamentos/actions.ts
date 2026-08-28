"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import { registarEventoServico } from "@/lib/service-events";
import { registarEventoOrcamento } from "@/lib/budget-events";

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

  await registarEventoOrcamento(supabase, {
    organizationId,
    budgetId: budget.id,
    tipo: "criado",
    descricao: "Orçamento criado.",
  });

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

// Marcar como enviado avança logo para "aguarda resposta" (o Admin não tem
// de fazer esse segundo clique manual) e agenda automaticamente o
// follow-up para daqui a 7 dias — é isto que a Central de Atenção lê depois
// (ver "Orçamento sem resposta"). Como o botão só existe enquanto o
// orçamento está em rascunho, uma vez clicado desaparece — não há como
// disparar isto duas vezes para o mesmo orçamento, logo não há follow-up
// duplicado mesmo que o orçamento seja reaberto/consultado depois.
export async function marcarEnviado(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const hoje = new Date();
  const enviado_em = hoje.toISOString().slice(0, 10);
  const followupDate = new Date(hoje);
  followupDate.setDate(followupDate.getDate() + 7);
  const followup_em = followupDate.toISOString().slice(0, 10);

  await supabase
    .from("budgets")
    .update({ estado: "aguarda_resposta", enviado_em, followup_em })
    .eq("id", id);

  await registarEventoOrcamento(supabase, {
    organizationId,
    budgetId: id,
    tipo: "enviado",
    descricao: `Marcado como enviado — follow-up agendado automaticamente para ${followup_em}.`,
  });

  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
  revalidatePath("/admin/atencao");
}

const AVANCAR_ESTADO_EVENTO: Record<string, "followup" | "recusado" | "cancelado"> = {
  followup: "followup",
  recusado: "recusado",
  cancelado: "cancelado",
};

export async function avancarEstado(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "");
  if (!id || !estado) return;
  await supabase.from("budgets").update({ estado }).eq("id", id);

  const tipoEvento = AVANCAR_ESTADO_EVENTO[estado];
  if (tipoEvento) {
    await registarEventoOrcamento(supabase, {
      organizationId,
      budgetId: id,
      tipo: tipoEvento,
      descricao: `Estado alterado para "${estado}".`,
    });
  }

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

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: service.id,
    tipo: "criado",
    descricao: "Serviço criado a partir de orçamento aceite.",
  });
  await registarEventoOrcamento(supabase, {
    organizationId,
    budgetId: id,
    tipo: "aceite",
    descricao: "Orçamento aceite — serviço criado.",
  });

  revalidatePath("/admin/orcamentos");
  redirect(`/admin/servicos/${service.id}`);
}
