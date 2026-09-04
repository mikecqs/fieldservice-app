"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId, getOrgIdAndRole } from "@/lib/auth";
import { registarEventoServico } from "@/lib/service-events";
import { registarEventoPedido } from "@/lib/request-events";
import { podeDecidirPedido } from "@/lib/pedido-estado";
import { ORIGENS_PEDIDO as ORIGENS_VALIDAS } from "@/lib/pedido-opcoes";
import { TIPO_VISITA_ORCAMENTO } from "@/lib/servico-estado";

// Única lógica que cria um orçamento a partir de um pedido — usada tanto
// quando o tipo já é "Orçamento" (automático, sem perguntar nada) como
// quando o Admin responde "Sim" à pergunta "é necessário orçamento?", e
// também depois de uma Visita Prévia concluída (criarOrcamentoDeVisita,
// em app/admin/servicos/actions.ts — por isso exportada). O pedido fica
// sempre associado ao orçamento (request_id), e o próprio estado do pedido
// reflete o que aconteceu — nunca fica por atualizar à mão.
export async function criarOrcamentoDePedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  pedido: { id: string; client_id: string; address_id: string; tipo: string; descricao: string },
  // Onda 3 (Etapa 9) — só o caminho "Agendamento" (dentro de criarPedido,
  // no mesmo pedido de formulário) tem este valor disponível para
  // transportar; decidirSemOrcamento chama esta função mais tarde, sem
  // acesso ao formulário original, por isso nunca o passa — cai sempre no
  // "normal" por omissão, exatamente como já acontecia antes desta etapa
  // para todos os serviços criados a partir de um Pedido.
  prioridade?: string
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
      prioridade: prioridade || "normal",
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

// Visita Prévia — mesmo mecanismo de Serviço/Agenda já
// usado por criarServicoDePedido acima, mas com tipo fixo
// (TIPO_VISITA_ORCAMENTO, nunca pedido.tipo) para nunca ser confundida com
// uma Manutenção/Instalação normal. Fica "por_agendar" tal como qualquer
// serviço novo — o Admin agenda-a na Agenda como a qualquer outro (aparece
// em "Pendentes de agendamento"), sem nenhum mecanismo novo. Só depois de
// "concluido" é que a ficha do Serviço oferece gerar o Orçamento a partir
// dela (podeGerarOrcamentoDeVisita, lib/servico-estado.ts).
async function criarVisitaOrcamentoDePedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  pedido: { id: string; client_id: string; address_id: string; descricao: string }
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
      tipo: TIPO_VISITA_ORCAMENTO,
      descricao: `Visita Prévia — ${pedido.descricao}`,
    })
    .select()
    .single();
  if (error || !service) throw new Error(error?.message || "Não foi possível criar a Visita Prévia.");

  // 'orcamento', não 'convertido' — este pedido ainda vai dar um Orçamento,
  // só depois de uma visita; mesmo estado que criarOrcamentoDePedido usa.
  await supabase.from("requests").update({ estado: "orcamento" }).eq("id", pedido.id);

  await registarEventoServico(supabase, {
    organizationId,
    serviceId: service.id,
    tipo: "criado",
    descricao: "Visita Prévia criada a partir do pedido — por agendar na Agenda.",
  });

  return service;
}

// Partilhada por /admin/pedidos/novo (ADMIN/SUPER_ADMIN) e
// /atendimento/pedidos/novo (ATENDIMENTO) — o comportamento depois de criar
// o pedido diverge por role (ver fim da função), porque ATENDIMENTO não tem
// acesso a orçamentos nem a nenhuma página /admin/*.
export async function criarPedido(formData: FormData) {
  const { organizationId, role } = await getOrgIdAndRole();
  const supabase = await createClient();

  const client_id = String(formData.get("client_id") || "");
  const address_id = String(formData.get("address_id") || "");
  const tipo = String(formData.get("tipo") || "");
  const descricao = String(formData.get("descricao") || "").trim();
  const origem = String(formData.get("origem") || "");
  const info_falta = formData.get("info_falta") === "on";
  // Onda 3 (Etapa 9) — só usada no ramo "Agendamento" abaixo (o único que
  // cria o Serviço já dentro desta mesma submissão); "requests" não tem
  // coluna de prioridade, por isso não é gravada no Pedido em si.
  const prioridade = String(formData.get("prioridade") || "normal");
  // Onda 3 (Etapa 10) — resposta à pergunta "É necessário orçamento?",
  // agora dentro do próprio formulário (NovoPedidoForm, quando
  // permitirDecisaoOrcamento). Só chega preenchida quando o tipo não é
  // "Orçamento" nem "Agendamento" — nos outros dois casos vem sempre vazia
  // e é ignorada, porque esses ramos nem chegam a olhar para ela.
  const necessita_orcamento = String(formData.get("necessita_orcamento") || "");
  // Só perguntada quando o pedido vai mesmo dar um Orçamento (tipo
  // "Orçamento" direto, ou "sim" acima) — ver NovoPedidoForm. Vazio/
  // inesperado cai no valor que já existia antes desta funcionalidade:
  // direto ao Orçamento, sem visita (nunca bloqueia por causa disto).
  const necessita_visita_previa = String(formData.get("necessita_visita_previa") || "");

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

  // "Agendamento" segue sempre direto para o Serviço/OS, sem perguntar nada
  // — nunca envolve Orçamento, por isso nunca pergunta visita prévia.
  if (tipo === "Agendamento") {
    const service = await criarServicoDePedido(supabase, organizationId, pedido, prioridade);
    redirect(`/admin/servicos/${service.id}`);
  }

  // "Orçamento" (tipo direto, sem perguntar "é necessário orçamento?") ou
  // "sim" a essa pergunta (Manutenção/Instalação) levam ambos ao mesmo
  // sítio: a pergunta "É necessária visita prévia?" (ver NovoPedidoForm).
  // "Sim" cria a visita (Serviço com tipo fixo, nunca o tipo do pedido) e
  // manda para a Agenda para a marcar; "não" segue exatamente como já
  // seguia antes desta funcionalidade — cria logo o Orçamento.
  const vaiParaOrcamento = tipo === "Orçamento" || necessita_orcamento === "sim";
  if (vaiParaOrcamento) {
    if (necessita_visita_previa === "sim") {
      await criarVisitaOrcamentoDePedido(supabase, organizationId, pedido);
      redirect("/admin/agenda");
    }
    const budget = await criarOrcamentoDePedido(supabase, organizationId, pedido.id, client_id);
    redirect(`/admin/orcamentos/${budget.id}`);
  }

  // Onda 3 (Etapa 10) — resposta já veio no mesmo formulário (ver
  // NovoPedidoForm): decide já, em vez de mandar para /decisao. Reutiliza
  // exatamente as mesmas duas funções que decidirComOrcamento/
  // decidirSemOrcamento já usavam — nunca uma segunda versão desta lógica.
  if (necessita_orcamento === "nao") {
    const service = await criarServicoDePedido(supabase, organizationId, pedido, prioridade);
    redirect(`/admin/servicos/${service.id}`);
  }

  // Rede de segurança (mantida) — só chega aqui se necessita_orcamento vier
  // vazio ou inesperado (ex: JavaScript desativado no toggle do
  // formulário). /decisao e decidirComOrcamento/decidirSemOrcamento
  // continuam exatamente como estavam, sem pergunta de visita prévia — este
  // caminho de exceção já existia antes desta funcionalidade e não foi
  // tocado.
  redirect(`/admin/pedidos/${pedido.id}/decisao`);
}

// Resposta "Sim" à pergunta "é necessário orçamento?".
export async function decidirComOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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

// Único caminho para editar um pedido já criado — restrito a ADMIN/
// SUPER_ADMIN (o layout de /admin/* já filtra isto, mas a Server Action
// nunca confia só nisso, mesmo padrão de criarUtilizador/
// resetPasswordUtilizador). Só descrição e morada são editáveis — nunca
// tipo/origem/cliente (mudar o cliente de um pedido já criado não faz
// sentido de negócio, e tipo/origem são decisões tomadas na criação). A
// morada nunca é texto livre: só pode ser trocada por outra morada já
// associada ao mesmo cliente (mesma validação já usada em criarPedido/
// aceitarOrcamento, nunca confiada cegamente ao valor submetido). Cada
// edição fica registada em request_events — histórico aditivo, nunca
// apagado — só quando algo realmente mudou.
export async function editarPedido(formData: FormData) {
  const { organizationId, role } = await getOrgIdAndRole();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Sem permissão para editar pedidos.");
  }
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const descricao = String(formData.get("descricao") || "").trim();
  const address_id = String(formData.get("address_id") || "");
  if (!id || !descricao || !address_id) {
    throw new Error("Descrição e morada são obrigatórias.");
  }

  const { data: pedido } = await supabase
    .from("requests")
    .select("descricao, address_id, client_id, client_addresses(label, endereco)")
    .eq("id", id)
    .single();
  if (!pedido) return;

  if (address_id !== pedido.address_id) {
    const { data: morada } = await supabase
      .from("client_addresses")
      .select("id, label, endereco")
      .eq("id", address_id)
      .eq("client_id", pedido.client_id)
      .single();
    if (!morada) {
      throw new Error("Escolhe uma morada já associada a este cliente.");
    }
  }

  const alteracoes: string[] = [];
  if (descricao !== pedido.descricao) alteracoes.push(`Descrição alterada.`);
  if (address_id !== pedido.address_id) {
    const { data: novaMorada } = await supabase.from("client_addresses").select("label, endereco").eq("id", address_id).single();
    const moradaAnterior = (pedido.client_addresses as any)?.endereco ?? "—";
    alteracoes.push(`Morada alterada de "${moradaAnterior}" para "${novaMorada?.endereco ?? "—"}".`);
  }

  if (alteracoes.length === 0) return;

  await supabase.from("requests").update({ descricao, address_id }).eq("id", id);

  await registarEventoPedido(supabase, {
    organizationId,
    requestId: id,
    tipo: "editado",
    descricao: alteracoes.join(" "),
  });

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
}

// Única fonte do "percurso completo" de um pedido (Pedido → Orçamento →
// Serviço(s), com o histórico de eventos de cada um) — usada tanto pela
// página completa (/admin/pedidos/[id]) como pelo popup de consulta rápida
// na lista, para nunca haver duas versões desta query. Reutiliza sempre
// budget_events/service_events já existentes — nunca um histórico novo.
// Sem verificação de role aqui: a barreira real é sempre a RLS de cada
// tabela (ex: ATENDIMENTO não tem policy nenhuma em budgets/services, por
// isso nunca veria esses dados mesmo chamando isto diretamente).
//
// `services` é uma LISTA (nunca .maybeSingle()) — a Visita Prévia tornou
// normal um Pedido ter mais do que um Serviço ao longo do tempo (a visita
// + o Serviço de Instalação/Manutenção que resulta do Orçamento aceite
// depois dela). Ordenada por `created_at` ascendente para a página mostrar
// sempre o percurso pela ordem em que aconteceu, sem esconder nada.
export async function obterDetalhePedido(id: string) {
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("requests")
    .select(
      "id, codigo, tipo, descricao, origem, info_falta, estado, created_at, client_id, address_id, clients(id, nome, codigo, telefone, email), client_addresses(label, endereco)"
    )
    .eq("id", id)
    .single();
  if (!pedido) return null;

  const [{ data: budget }, { data: services }, { data: requestEvents }, { data: enderecosCliente }] = await Promise.all([
    supabase.from("budgets").select("id, estado, numero").eq("request_id", id).maybeSingle(),
    supabase
      .from("services")
      .select("id, estado, tipo, budget_id")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("request_events")
      .select("id, tipo, descricao, created_at, profiles(nome)")
      .eq("request_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("client_addresses").select("id, label, endereco").eq("client_id", pedido.client_id).order("label"),
  ]);

  const serviceIds = (services ?? []).map((s) => s.id);
  const [{ data: budgetEvents }, { data: serviceEventsRaw }] = await Promise.all([
    budget
      ? supabase.from("budget_events").select("id, tipo, descricao, created_at").eq("budget_id", budget.id).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    serviceIds.length > 0
      ? supabase
          .from("service_events")
          .select("id, service_id, tipo, descricao, created_at")
          .in("service_id", serviceIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Agrupado por serviço — cada bloco da lista mostra só o seu próprio
  // histórico, nunca o de outro Serviço do mesmo pedido misturado.
  const serviceEventsByServiceId: Record<string, any[]> = {};
  for (const ev of serviceEventsRaw ?? []) {
    (serviceEventsByServiceId[ev.service_id] ??= []).push(ev);
  }

  return {
    pedido,
    budget: budget ?? null,
    budgetEvents: budgetEvents ?? [],
    services: services ?? [],
    serviceEventsByServiceId,
    requestEvents: requestEvents ?? [],
    enderecosCliente: enderecosCliente ?? [],
  };
}

// Continua a existir para pedidos que ficaram parados em "novo" (ex: o
// Admin fechou o browser a meio da pergunta) — a lista de Pedidos ainda
// mostra este botão manual como rede de segurança.
export async function converterEmOrcamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
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
