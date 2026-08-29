"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId, getOrgIdAndRole } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";
import { podeDecidirPedido } from "@/lib/pedido-estado";

const ORIGENS_VALIDAS = ["Telefone", "Loja", "Email", "Outro"];

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

// Única lógica que cria um serviço diretamente a partir de um pedido, sem
// passar por orçamento — usada tanto pelo tipo "Agendamento" (sempre direto,
// sem perguntar nada) como pela resposta "Não" à pergunta "é necessário
// orçamento?" em decidirSemOrcamento. A morada escolhida no pedido acompanha
// sempre o serviço (address_id), revalidada aqui contra o cliente do pedido
// — nunca só confiada no que já foi validado na criação do pedido.
async function criarServicoDePedido(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  pedido: { id: string; client_id: string; address_id: string; tipo: string; descricao: string }
) {
  const { data: morada } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("id", pedido.address_id)
    .eq("client_id", pedido.client_id)
    .single();
  if (!morada) throw new Error("A morada do pedido não pertence ao cliente do pedido.");

  const { data: service, error } = await supabase
    .from("services")
    .insert({
      organization_id: organizationId,
      client_id: pedido.client_id,
      address_id: pedido.address_id,
      request_id: pedido.id,
      tipo: pedido.tipo,
      descricao: pedido.descricao,
    })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar o serviço.");

  await supabase.from("requests").update({ estado: "convertido" }).eq("id", pedido.id);

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: service.id,
    tipo: "criado",
    descricao: `Serviço criado a partir do pedido (${pedido.tipo}), sem orçamento.`,
  });

  return service;
}

// Partilhada por /admin/pedidos/novo (ADMIN/SUPER_ADMIN) e
// /atendimento/pedidos/novo (ATENDIMENTO) — o comportamento depois de criar
// o pedido diverge por role (ver fim da função), porque ATENDIMENTO não tem
// acesso a orçamentos nem a nenhuma página /admin/*.
export async function criarPedido(formData: FormData) {
  const { organizationId, role } = await getOrgIdAndRole();
  const supabase = createClient();

  const client_id = String(formData.get("client_id") || "");
  const address_id = String(formData.get("address_id") || "");
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "").trim();
  const origem = String(formData.get("origem") || "");
  const info_falta = formData.get("info_falta") === "on";

  if (!client_id || !address_id || !tipo || !descricao) return;
  if (!ORIGENS_VALIDAS.includes(origem)) return;

  // Nunca confiar que o address_id do formulário pertence mesmo ao cliente
  // selecionado — mesmo vindo de um <select> já filtrado no cliente, um
  // pedido forjado poderia enviar a morada de outro cliente qualquer. Esta
  // verificação garante que morada e cliente nunca ficam desalinhados,
  // reforçando o que a RLS de client_addresses já limita por organização.
  const { data: morada } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("id", address_id)
    .eq("client_id", client_id)
    .single();
  if (!morada) throw new Error("A morada selecionada não pertence ao cliente selecionado.");

  const { data: pedido, error } = await supabase
    .from("requests")
    .insert({ organization_id: organizationId, client_id, address_id, tipo, descricao, origem, info_falta })
    .select()
    .single();
  if (error || !pedido) throw new Error(error?.message || "Não foi possível criar o pedido.");

  // ATENDIMENTO só cria e consulta pedidos — nunca decide orçamento nem
  // acede a /admin/*, por isso fica sempre no seu próprio detalhe do pedido.
  if (role === "ATENDIMENTO") {
    revalidatePath("/atendimento/pedidos");
    redirect(`/atendimento/pedidos/${pedido.id}`);
  }

  revalidatePath("/admin/pedidos");

  // "Orçamento" segue sempre para lá, sem perguntar nada. "Agendamento"
  // segue sempre direto para o Serviço/OS, também sem perguntar nada — só
  // "Manutenção"/"Instalação" perguntam primeiro se é necessário orçamento.
  if (tipo === "Orçamento") {
    const budget = await criarOrcamentoDePedido(supabase, organizationId, pedido.id, client_id);
    redirect(`/admin/orcamentos/${budget.id}`);
  }
  if (tipo === "Agendamento") {
    const service = await criarServicoDePedido(supabase, organizationId, pedido);
    redirect(`/admin/servicos/${service.id}`);
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

  // Nunca decidir duas vezes o mesmo pedido — revisitar esta página (ex:
  // botão "voltar" do browser) depois de já ter sido decidido por outro
  // caminho criaria um segundo orçamento órfão para o mesmo pedido.
  const { data: pedidoAtual } = await supabase.from("requests").select("estado").eq("id", requestId).single();
  if (!pedidoAtual || !podeDecidirPedido(pedidoAtual)) {
    throw new Error("Este pedido já foi decidido — não é possível criar outro orçamento a partir dele.");
  }

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

  const { data: pedido } = await supabase
    .from("requests")
    .select("id, estado, client_id, address_id, tipo, descricao")
    .eq("id", requestId)
    .single();
  if (!pedido) return;

  if (!podeDecidirPedido(pedido)) {
    throw new Error("Este pedido já foi decidido — não é possível criar outro serviço a partir dele.");
  }

  const service = await criarServicoDePedido(supabase, organizationId, pedido);

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
  revalidatePath("/admin/dashboard");
}

export async function arquivarPedido(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;

  // Só se pode arquivar um pedido ainda 'novo' — um já convertido em
  // orçamento/serviço não deve voltar a ficar "arquivado" por cima disso.
  const { data: pedidoAtual } = await supabase.from("requests").select("estado").eq("id", id).single();
  if (!pedidoAtual || !podeDecidirPedido(pedidoAtual)) {
    throw new Error("Este pedido já foi decidido e não pode ser arquivado.");
  }

  await supabase.from("requests").update({ estado: "arquivado" }).eq("id", id);
  revalidatePath("/admin/pedidos");
}

// Única fonte do "percurso completo" de um pedido (Pedido → Orçamento →
// Serviço/OS, com o histórico de eventos de cada um) — usada tanto pela
// página completa (/admin/pedidos/[id]) como pelo popup de consulta rápida
// na lista, para nunca haver duas versões desta query. Reutiliza sempre
// budget_events/service_events já existentes — nunca um histórico novo.
// Sem verificação de role aqui: a barreira real é sempre a RLS de cada
// tabela (ex: ATENDIMENTO não tem policy nenhuma em budgets/services, por
// isso nunca veria esses dados mesmo chamando isto diretamente).
export async function obterDetalhePedido(id: string) {
  const supabase = createClient();

  const { data: pedido } = await supabase
    .from("requests")
    .select(
      "id, codigo, tipo, descricao, origem, info_falta, estado, created_at, client_id, clients(id, nome, codigo, telefone, email), client_addresses(label, endereco)"
    )
    .eq("id", id)
    .single();
  if (!pedido) return null;

  const [{ data: budget }, { data: service }] = await Promise.all([
    supabase.from("budgets").select("id, estado, numero").eq("request_id", id).maybeSingle(),
    supabase.from("services").select("id, estado, tipo").eq("request_id", id).maybeSingle(),
  ]);

  const [{ data: budgetEvents }, { data: serviceEvents }] = await Promise.all([
    budget
      ? supabase.from("budget_events").select("id, tipo, descricao, created_at").eq("budget_id", budget.id).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    service
      ? supabase.from("service_events").select("id, tipo, descricao, created_at").eq("service_id", service.id).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return {
    pedido,
    budget: budget ?? null,
    service: service ?? null,
    budgetEvents: budgetEvents ?? [],
    serviceEvents: serviceEvents ?? [],
  };
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

  const { data: pedidoAtual } = await supabase.from("requests").select("estado").eq("id", requestId).single();
  if (!pedidoAtual || !podeDecidirPedido(pedidoAtual)) {
    throw new Error("Este pedido já foi decidido — não é possível criar outro orçamento a partir dele.");
  }

  const budget = await criarOrcamentoDePedido(supabase, organizationId, requestId, clientId);
  revalidatePath("/admin/pedidos");
  redirect(`/admin/orcamentos/${budget.id}`);
}
