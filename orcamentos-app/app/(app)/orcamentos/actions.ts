"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import {
  podeAceitarOrcamento,
  podeCancelarOrcamento,
  podeEditarItensOrcamento,
  podeMarcarEnviado,
  podeMarcarFollowup,
  podeRecusarOrcamento,
} from "@/lib/orcamento-estado";

async function buscarEstadoOrcamento(budgetId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budgets")
    .select("id, estado")
    .eq("id", budgetId)
    .maybeSingle();
  return data as { id: string; estado: string } | null;
}

export async function criarOrcamento(formData: FormData): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const clientId = String(formData.get("clientId") ?? "");
  let idCliente = clientId;

  if (clientId === "novo") {
    const nome = String(formData.get("novoClienteNome") ?? "").trim();
    if (!nome) {
      return { erro: "Indique o nome do cliente." };
    }
    const { data: novoCliente, error: erroCliente } = await supabase
      .from("clients")
      .insert({
        company_id: empresa.id,
        nome,
        empresa: String(formData.get("novoClienteEmpresa") ?? "").trim() || null,
        telefone: String(formData.get("novoClienteTelefone") ?? "").trim() || null,
        email: String(formData.get("novoClienteEmail") ?? "").trim() || null,
        morada: String(formData.get("novoClienteMorada") ?? "").trim() || null,
        nif: String(formData.get("novoClienteNif") ?? "").trim() || null,
      })
      .select("id")
      .single();

    if (erroCliente || !novoCliente) {
      return { erro: "Não foi possível criar o cliente." };
    }
    idCliente = novoCliente.id;
  }

  if (!idCliente || idCliente === "novo") {
    return { erro: "Selecione ou crie um cliente." };
  }

  const { data: orcamento, error } = await supabase
    .from("budgets")
    .insert({
      company_id: empresa.id,
      client_id: idCliente,
      condicoes: empresa.condicoes_padrao ?? null,
      iva_percent: 23,
      validade_dias: 30,
    })
    .select("id")
    .single();

  if (error || !orcamento) {
    return { erro: "Não foi possível criar o orçamento." };
  }

  redirect(`/orcamentos/${orcamento.id}`);
}

export async function adicionarItem(budgetId: string, formData: FormData): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeEditarItensOrcamento(orcamento)) {
    return { erro: "Este orçamento já não permite editar itens." };
  }

  const descricao = String(formData.get("descricao") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 1);
  const valorUnitario = Number(formData.get("valorUnitario") ?? 0);

  if (!descricao || !Number.isFinite(quantidade) || !Number.isFinite(valorUnitario)) {
    return { erro: "Preencha a descrição, quantidade e valor do item." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").insert({
    budget_id: budgetId,
    descricao,
    quantidade,
    valor_unitario: valorUnitario,
  });

  if (error) {
    return { erro: "Não foi possível adicionar o item." };
  }

  revalidatePath(`/orcamentos/${budgetId}`);
  return {};
}

export async function removerItem(budgetId: string, itemId: string): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeEditarItensOrcamento(orcamento)) {
    return { erro: "Este orçamento já não permite editar itens." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").delete().eq("id", itemId);

  if (error) {
    return { erro: "Não foi possível remover o item." };
  }

  revalidatePath(`/orcamentos/${budgetId}`);
  return {};
}

export async function atualizarDetalhesOrcamento(
  budgetId: string,
  formData: FormData
): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento) {
    return { erro: "Orçamento não encontrado." };
  }

  const supabase = await createClient();
  const atualizacao: Record<string, unknown> = {
    condicoes: String(formData.get("condicoes") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
    validade_dias: Number(formData.get("validadeDias") ?? 30),
  };

  // IVA só é ajustável enquanto o orçamento ainda está em rascunho — a
  // mesma regra que protege os itens, para o total nunca variar depois de
  // enviado ao cliente.
  if (podeEditarItensOrcamento(orcamento)) {
    atualizacao.iva_percent = Number(formData.get("ivaPercent") ?? 23);
  }

  const { error } = await supabase.from("budgets").update(atualizacao).eq("id", budgetId);

  if (error) {
    return { erro: "Não foi possível guardar as alterações." };
  }

  revalidatePath(`/orcamentos/${budgetId}`);
  return {};
}

export async function marcarEnviado(budgetId: string): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeMarcarEnviado(orcamento)) {
    return { erro: "Este orçamento não pode ser marcado como enviado." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({ estado: "enviado", enviado_em: new Date().toISOString() })
    .eq("id", budgetId);

  if (error) return { erro: "Não foi possível marcar como enviado." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
  return {};
}

export async function marcarFollowup(budgetId: string, formData: FormData): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeMarcarFollowup(orcamento)) {
    return { erro: "Este orçamento não pode ter um follow-up marcado." };
  }

  const data = String(formData.get("followupEm") ?? "");
  if (!data) {
    return { erro: "Indique a data do follow-up." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({ estado: "followup", followup_em: data })
    .eq("id", budgetId);

  if (error) return { erro: "Não foi possível marcar o follow-up." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
  revalidatePath("/follow-up");
  return {};
}

export async function aceitarOrcamento(budgetId: string): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeAceitarOrcamento(orcamento)) {
    return { erro: "Este orçamento não pode ser marcado como aceite." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ estado: "aceite" }).eq("id", budgetId);

  if (error) return { erro: "Não foi possível marcar como aceite." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
  revalidatePath("/follow-up");
  revalidatePath("/dashboard");
  return {};
}

export async function recusarOrcamento(budgetId: string): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeRecusarOrcamento(orcamento)) {
    return { erro: "Este orçamento não pode ser marcado como recusado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ estado: "recusado" }).eq("id", budgetId);

  if (error) return { erro: "Não foi possível marcar como recusado." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
  revalidatePath("/follow-up");
  revalidatePath("/dashboard");
  return {};
}

export async function cancelarOrcamento(budgetId: string): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeCancelarOrcamento(orcamento)) {
    return { erro: "Este orçamento não pode ser cancelado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ estado: "cancelado" }).eq("id", budgetId);

  if (error) return { erro: "Não foi possível cancelar." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
  revalidatePath("/follow-up");
  revalidatePath("/dashboard");
  return {};
}
