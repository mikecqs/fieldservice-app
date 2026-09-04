"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { podeAvancarCompraParaEstado } from "@/lib/compra-estado";

// BLOCO 17 — nenhum campo (nem combinação de campos) de purchases/
// purchase_items pode ter uma UNIQUE constraint: descrição, fornecedor,
// serviço e data prevista podem legitimamente repetir-se (ex: duas
// encomendas separadas do mesmo material, para o mesmo serviço, em dias
// diferentes) — por isso a única defesa possível contra duplo-submit (duplo
// clique, ou reenvio de rede do mesmo formulário) sem alterar o modelo de
// dados é uma verificação prévia, feita aqui contra o conteúdo completo
// (cabeçalho + itens, não só descrição/fornecedor) e limitada a uma janela
// curta (10s) — para nunca bloquear uma compra genuinamente repetida
// passado esse intervalo.
//
// Race condition residual, aceite e documentada: entre o SELECT abaixo e o
// INSERT não existe nenhum lock nem constraint da BD a impedir que dois
// pedidos verdadeiramente simultâneos (ex: dois retries de rede do mesmo
// POST, quase ao mesmo milissegundo) passem ambos a verificação antes de
// qualquer um gravar — nesse caso residual, ainda se cria uma compra
// duplicada. Sem uma unique constraint sobre campos que possam
// legitimamente repetir-se, esta janela não é fechável a partir da
// aplicação.
function mesmosItensCompra(a: { nome: string; qtd: number }[], b: { nome: string; qtd: number }[]) {
  if (a.length !== b.length) return false;
  const normalizar = (lista: typeof a) => lista.map((i) => `${i.nome}::${i.qtd}`).sort();
  const na = normalizar(a);
  const nb = normalizar(b);
  return na.every((v, i) => v === nb[i]);
}

export async function criarCompra(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();

  const descricao = String(formData.get("descricao") || "");
  const fornecedor = String(formData.get("fornecedor") || "");
  const data_prevista = String(formData.get("data_prevista") || "") || null;
  const service_id = String(formData.get("service_id") || "") || null;
  const nomes = formData.getAll("item_nome") as string[];
  const qtds = formData.getAll("item_qtd") as string[];

  if (!descricao) return;

  const items = nomes
    .map((nome, i) => ({ nome: nome.trim(), qtd: Number(qtds[i] || 1) }))
    .filter((i) => i.nome);

  // Mesma validação de sinal/finitude já aplicada a valor_unit em
  // adicionarItem (orçamentos, BLOCO 14/15/18) — sem isto, uma quantidade
  // negativa ou não numérica passava direto para purchase_items.
  if (items.some((i) => !Number.isFinite(i.qtd) || i.qtd < 0)) {
    throw new Error("A quantidade de cada item tem de ser um número igual ou superior a 0.");
  }

  const desde = new Date(Date.now() - 10_000).toISOString();
  let candidatos = supabase
    .from("purchases")
    .select("id, purchase_items(nome, qtd)")
    .eq("organization_id", organizationId)
    .eq("descricao", descricao)
    .eq("fornecedor", fornecedor)
    .gte("created_at", desde);
  candidatos = service_id ? candidatos.eq("service_id", service_id) : candidatos.is("service_id", null);
  candidatos = data_prevista ? candidatos.eq("data_prevista", data_prevista) : candidatos.is("data_prevista", null);
  const { data: recentes } = await candidatos;

  const duplicada = (recentes ?? []).some((c: any) => mesmosItensCompra(items, c.purchase_items ?? []));
  if (duplicada) {
    revalidatePath("/admin/compras");
    redirect("/admin/compras");
  }

  const { data: compra, error } = await supabase
    .from("purchases")
    .insert({ organization_id: organizationId, descricao, fornecedor, data_prevista, service_id })
    .select()
    .single();
  if (error || !compra) throw new Error(error?.message || "Não foi possível criar a compra.");

  if (items.length > 0) {
    await supabase.from("purchase_items").insert(items.map((i) => ({ purchase_id: compra.id, ...i })));
  }

  revalidatePath("/admin/compras");
  redirect("/admin/compras");
}

// Nunca aceita o estado de destino às cegas: podeAvancarCompraParaEstado só
// permite exatamente as transições que a UI já oferecia (por_encomendar →
// encomendada → recebida), agora também validadas aqui, não só pelo botão
// que a página mostra.
export async function avancarEstadoCompra(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "");
  if (!id || !estado) return;

  const { data: compraAtual } = await supabase.from("purchases").select("estado").eq("id", id).single();
  if (!compraAtual || !podeAvancarCompraParaEstado(compraAtual, estado)) {
    throw new Error(`Não é possível alterar esta compra para "${estado}" a partir do estado atual.`);
  }

  await supabase.from("purchases").update({ estado }).eq("id", id);
  revalidatePath("/admin/compras");
}

// Atalho usado a partir da página de Materiais: cria uma compra já com um
// único item, para um material planeado que ainda não tem compra associada.
// Nunca fica sem origem: service_id vem sempre do material de onde partiu.
//
// Verificação prévia (não uma constraint da BD, ver nota em criarCompra
// acima): se já existir uma compra em aberto para este material+serviço,
// não cria uma segunda — devolve em silêncio. Reduz muito a hipótese de
// duplicado por duplo clique, mas tem a mesma race condition residual
// documentada em criarCompra — dois pedidos verdadeiramente simultâneos
// podem ambos passar este SELECT antes de qualquer um gravar.
export async function criarCompraRapida(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const nome = String(formData.get("nome") || "");
  const qtd = Number(formData.get("qtd") || 1);
  const service_id = String(formData.get("service_id") || "") || null;
  if (!nome) return;
  if (!Number.isFinite(qtd) || qtd < 0) {
    throw new Error("A quantidade tem de ser um número igual ou superior a 0.");
  }

  if (service_id) {
    const { data: existentes } = await supabase
      .from("purchases")
      .select("id, purchase_items(nome)")
      .eq("service_id", service_id)
      .in("estado", ["por_encomendar", "encomendada", "parcial"]);
    const jaPedido = (existentes ?? []).some((c: any) =>
      (c.purchase_items ?? []).some((i: any) => i.nome === nome)
    );
    if (jaPedido) {
      revalidatePath(`/admin/servicos/${service_id}`);
      return;
    }
  }

  const { data: compra, error } = await supabase
    .from("purchases")
    .insert({ organization_id: organizationId, descricao: nome, service_id })
    .select()
    .single();
  if (error || !compra) throw new Error(error?.message || "Não foi possível criar a compra.");

  await supabase.from("purchase_items").insert({ purchase_id: compra.id, nome, qtd });

  if (service_id) revalidatePath(`/admin/servicos/${service_id}`);
  revalidatePath("/admin/compras");
}
