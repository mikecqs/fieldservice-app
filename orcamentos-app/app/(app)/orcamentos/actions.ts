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
  podeMarcarFaturado,
  podeMarcarFollowup,
  podeMarcarServicoRealizado,
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

// Histórico aditivo do percurso do orçamento (budget_events) já não é
// escrito daqui — passou a ser gerado automaticamente por triggers em
// Postgres sempre que `budgets` é criado/muda de estado (ver migração
// 005_state_machine_enforcement.sql). Isto fecha a lacuna em que um
// insert direto à API do Supabase conseguia forjar um evento sem a ação
// correspondente ter realmente acontecido — agora só existe evento se a
// mudança de estado aconteceu de facto, na mesma transação.

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

  if (clientId !== "novo") {
    // Nunca confiar no clientId vindo do formulário sem confirmar que é
    // mesmo um cliente desta empresa — evita ligar um orçamento a um
    // client_id de outra empresa (a FK não sabe nada de organization_id,
    // só a RLS de `clients` sabe, e essa só filtra leituras/joins, não
    // impede a referência ficar gravada em `budgets.client_id`).
    const { data: clienteExistente } = await supabase
      .from("clients")
      .select("id")
      .eq("id", idCliente)
      .eq("company_id", empresa.id)
      .maybeSingle();

    if (!clienteExistente) {
      return { erro: "Cliente inválido." };
    }
  }

  // Modelo opcional: se escolhido, confirma que pertence à empresa antes
  // de o usar (mesmo cuidado do clientId acima — nunca confiar num id
  // vindo do formulário sem validar a posse).
  const templateId = String(formData.get("templateId") ?? "").trim();
  let modelo: {
    condicoes: string | null;
    iva_percent: number;
    validade_dias: number;
    budget_template_items: { descricao: string; quantidade: number; valor_unitario: number }[];
  } | null = null;

  if (templateId) {
    const { data } = await supabase
      .from("budget_templates")
      .select("condicoes, iva_percent, validade_dias, budget_template_items(descricao, quantidade, valor_unitario)")
      .eq("id", templateId)
      .eq("company_id", empresa.id)
      .maybeSingle();

    if (!data) {
      return { erro: "Modelo inválido." };
    }
    modelo = data;
  }

  const { data: orcamento, error } = await supabase
    .from("budgets")
    .insert({
      company_id: empresa.id,
      client_id: idCliente,
      condicoes: modelo ? modelo.condicoes : empresa.condicoes_padrao ?? null,
      iva_percent: modelo ? modelo.iva_percent : 23,
      validade_dias: modelo ? modelo.validade_dias : 30,
    })
    .select("id")
    .single();

  if (error || !orcamento) {
    return { erro: "Não foi possível criar o orçamento." };
  }

  if (modelo && modelo.budget_template_items.length > 0) {
    await supabase.from("budget_items").insert(
      modelo.budget_template_items.map((item) => ({
        budget_id: orcamento.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
      }))
    );
  }

  redirect(`/orcamentos/${orcamento.id}`);
}

export async function duplicarOrcamento(budgetId: string): Promise<{ erro?: string }> {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: original } = await supabase
    .from("budgets")
    .select("client_id, condicoes, iva_percent, validade_dias, budget_items(descricao, quantidade, valor_unitario)")
    .eq("id", budgetId)
    .eq("company_id", empresa.id)
    .maybeSingle();

  if (!original) {
    return { erro: "Orçamento não encontrado." };
  }

  // Nunca copia numero/estado/enviado_em/followup_em/notas — o duplicado
  // é sempre um orçamento novo, a começar do zero em rascunho, com o seu
  // próprio número de sequência. `duplicado_de_id` liga ao original só
  // para o trigger de log (budgets_log_created) escrever o evento
  // "duplicado" sozinho — ver migração 005.
  const { data: novoOrcamento, error } = await supabase
    .from("budgets")
    .insert({
      company_id: empresa.id,
      client_id: original.client_id,
      condicoes: original.condicoes,
      iva_percent: original.iva_percent,
      validade_dias: original.validade_dias,
      duplicado_de_id: budgetId,
    })
    .select("id")
    .single();

  if (error || !novoOrcamento) {
    return { erro: "Não foi possível duplicar o orçamento." };
  }

  const items = (original.budget_items ?? []) as { descricao: string; quantidade: number; valor_unitario: number }[];
  if (items.length > 0) {
    const { error: erroItens } = await supabase.from("budget_items").insert(
      items.map((item) => ({
        budget_id: novoOrcamento.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
      }))
    );
    if (erroItens) {
      return { erro: "Orçamento duplicado, mas houve um erro a copiar os itens." };
    }
  }

  redirect(`/orcamentos/${novoOrcamento.id}`);
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
  // Filtra também por budget_id (não só o id do item): a RLS já impede
  // apagar um item de outra empresa, mas sem este filtro seria possível
  // apagar, a partir de um orçamento em rascunho, um item que na
  // verdade pertence a outro orçamento já enviado/bloqueado da mesma
  // empresa (bastava passar o par budgetId/itemId errado).
  const { error } = await supabase.from("budget_items").delete().eq("id", itemId).eq("budget_id", budgetId);

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

  // Enviar já agenda o follow-up automaticamente — passa direto para
  // "followup" em vez de ficar num estado intermédio "enviado" que
  // exigiria sempre uma segunda ação manual só para marcar o follow-up.
  // A data continua ajustável depois (ver marcarFollowup).
  const empresa = await requireCompany();
  const followupEm = new Date(Date.now() + empresa.followup_dias_padrao * 86400000).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({ estado: "followup", enviado_em: new Date().toISOString(), followup_em: followupEm })
    .eq("id", budgetId);

  if (error) return { erro: "Não foi possível marcar como enviado." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
  revalidatePath("/follow-up");
  revalidatePath("/dashboard");
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

export async function marcarServicoRealizado(budgetId: string): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeMarcarServicoRealizado(orcamento)) {
    return { erro: "Este orçamento não pode ser marcado como serviço realizado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ estado: "servico_realizado" }).eq("id", budgetId);

  if (error) return { erro: "Não foi possível marcar o serviço como realizado." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
  return {};
}

// Único caminho para um orçamento ficar mesmo concluído — nunca se salta
// direto de "aceite" para aqui (podeMarcarFaturado exige "servico_realizado").
export async function marcarFaturado(budgetId: string): Promise<{ erro?: string }> {
  const orcamento = await buscarEstadoOrcamento(budgetId);
  if (!orcamento || !podeMarcarFaturado(orcamento)) {
    return { erro: "Este orçamento não pode ser marcado como faturado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ estado: "faturado" }).eq("id", budgetId);

  if (error) return { erro: "Não foi possível marcar como faturado." };

  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/orcamentos");
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
