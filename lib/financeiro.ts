import { createClient } from "@/lib/supabase/server";

export type FinanceiroRange = { desde: string; ate: string; label: string };

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function computeRange(preset: string, customDesde?: string, customAte?: string): FinanceiroRange {
  const hoje = new Date();
  if (preset === "hoje") {
    const d = toISO(hoje);
    return { desde: d, ate: d, label: "Hoje" };
  }
  if (preset === "semana") {
    const diaSemana = hoje.getDay() === 0 ? 7 : hoje.getDay();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - (diaSemana - 1));
    return { desde: toISO(inicio), ate: toISO(hoje), label: "Esta semana" };
  }
  if (preset === "ano") {
    const inicio = new Date(hoje.getFullYear(), 0, 1);
    return { desde: toISO(inicio), ate: toISO(hoje), label: "Este ano" };
  }
  if (preset === "custom" && customDesde && customAte) {
    return { desde: customDesde, ate: customAte, label: "Personalizado" };
  }
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { desde: toISO(inicio), ate: toISO(hoje), label: "Este mês" };
}

export function formatDuracao(horas: number | null) {
  if (horas === null) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1)}h`;
  return `${(horas / 24).toFixed(1)} dias`;
}

export function formatEuros(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

// Todos os números abaixo vêm de dados reais já gravados pela app (services,
// service_events, requests, budgets/budget_items) — nada é inventado. As
// queries não filtram organization_id explicitamente porque a RLS de cada
// tabela já garante que só vêm linhas da própria empresa.
// organizationId só é necessário quando "supabase" é um cliente que ignora
// RLS (ex: service role, usado pela sincronização do Google Sheets) — nesse
// caso é a ÚNICA barreira de isolamento entre empresas, por isso tem de ser
// aplicado explicitamente a cada query. Com o cliente normal (sessão do
// utilizador), a RLS já trata disto e o parâmetro pode ser omitido.
export async function getFinanceiroStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  desde: string,
  ate: string,
  organizationId?: string
) {
  const emRange = (iso: string) => {
    const d = iso.slice(0, 10);
    return d >= desde && d <= ate;
  };

  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);

  const [{ data: servicos }, { data: eventos }, { data: requestsData }, { data: budgets }] = await Promise.all([
    withOrg(
      supabase
        .from("services")
        .select(
          "id, tipo, estado, valor, faturacao_estado, faturacao_valor, faturacao_data, faturacao_liquidado_data, request_id, created_at"
        )
    ),
    withOrg(supabase.from("service_events").select("service_id, tipo, created_at")).order("created_at", { ascending: true }),
    withOrg(supabase.from("requests").select("id, created_at")),
    withOrg(supabase.from("budgets").select("id, criado_em, request_id, budget_items(tipo, qtd, valor_unit)")),
  ]);

  const servicoPorId = new Map((servicos ?? []).map((s) => [s.id, s]));
  const requestPorId = new Map((requestsData ?? []).map((r) => [r.id, r]));

  // --- Faturação ---
  // "Faturado" (regime de acréscimo, âncora faturacao_data) inclui sempre
  // 'liquidado' — liquidar não desfaz o facto de ter sido faturado, só
  // acrescenta que já foi recebido. "Recebido" (regime de caixa, âncora
  // faturacao_liquidado_data) é um número à parte, nunca subtraído de
  // totalFaturado — os dois convivem (Faturado vs Recebido).
  const faturados = (servicos ?? []).filter(
    (s) =>
      (s.faturacao_estado === "faturado" || s.faturacao_estado === "liquidado") &&
      s.faturacao_data &&
      emRange(s.faturacao_data)
  );
  const totalFaturado = faturados.reduce((acc, s) => acc + Number(s.faturacao_valor ?? 0), 0);
  const totalPorFaturar = (servicos ?? [])
    .filter((s) => s.estado === "concluido" && s.faturacao_estado === "por_faturar")
    .reduce((acc, s) => acc + Number(s.valor ?? 0), 0);
  const totalPorReceber = faturados
    .filter((s) => s.faturacao_estado === "faturado")
    .reduce((acc, s) => acc + Number(s.faturacao_valor ?? 0), 0);
  const nFaturados = faturados.length;
  const valorMedio = nFaturados ? totalFaturado / nFaturados : 0;

  const liquidados = (servicos ?? []).filter(
    (s) => s.faturacao_estado === "liquidado" && s.faturacao_liquidado_data && emRange(s.faturacao_liquidado_data)
  );
  const totalRecebido = liquidados.reduce((acc, s) => acc + Number(s.faturacao_valor ?? 0), 0);
  const nLiquidados = liquidados.length;

  // --- Produção ---
  const eventosNoRange = (eventos ?? []).filter((e) => emRange(e.created_at));
  const concluidosNoRange = eventosNoRange.filter((e) => e.tipo === "concluido");
  const novaVisitaNoRange = eventosNoRange.filter((e) => e.tipo === "nova_visita");
  const naoRealizadoNoRange = eventosNoRange.filter((e) => e.tipo === "nao_realizado");
  const orcamentosNoRange = (budgets ?? []).filter((b) => b.criado_em && emRange(b.criado_em));
  const pendentes = (servicos ?? []).filter((s) => !["concluido", "cancelado", "nao_realizado"].includes(s.estado)).length;

  const porTipoCount = new Map<string, number>();
  for (const e of concluidosNoRange) {
    const tipo = servicoPorId.get(e.service_id)?.tipo ?? "—";
    porTipoCount.set(tipo, (porTipoCount.get(tipo) ?? 0) + 1);
  }
  let servicoMaisRealizado: string | null = null;
  let maxCount = 0;
  for (const [tipo, c] of porTipoCount) {
    if (c > maxCount) {
      maxCount = c;
      servicoMaisRealizado = tipo;
    }
  }

  // --- Tempos (âncora: o evento 'concluido' tem de cair no período) ---
  const primeiroEvento = new Map<string, Map<string, string>>();
  for (const e of eventos ?? []) {
    if (!primeiroEvento.has(e.service_id)) primeiroEvento.set(e.service_id, new Map());
    const m = primeiroEvento.get(e.service_id)!;
    if (!m.has(e.tipo)) m.set(e.tipo, e.created_at);
  }

  const diffHoras = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;

  const temposPedidoConclusao: number[] = [];
  const temposPedidoAgendamento: number[] = [];
  const temposAgendamentoInicio: number[] = [];
  const temposInicioConclusao: number[] = [];
  const temposFechoValidacao: number[] = [];
  const temposValidacaoFaturacao: number[] = [];
  const temposPedidoFaturacao: number[] = [];
  const temposFaturacaoLiquidacao: number[] = [];
  const temposPorTipo = new Map<string, number[]>();

  for (const [serviceId, m] of primeiroEvento) {
    const concluidoAt = m.get("concluido");
    const servico = servicoPorId.get(serviceId);
    const pedido = servico?.request_id ? requestPorId.get(servico.request_id) : null;
    const validadoAt = m.get("validado");
    const faturadoAt = m.get("faturado");
    const liquidadoAt = m.get("liquidado");
    const agendadoAt = m.get("agendado");

    if (agendadoAt && emRange(agendadoAt) && pedido?.created_at) {
      temposPedidoAgendamento.push(diffHoras(pedido.created_at, agendadoAt));
    }

    if (concluidoAt && emRange(concluidoAt)) {
      const iniciadoAt = m.get("iniciado") ?? m.get("corrigido");

      if (pedido?.created_at) temposPedidoConclusao.push(diffHoras(pedido.created_at, concluidoAt));
      if (agendadoAt && iniciadoAt) temposAgendamentoInicio.push(diffHoras(agendadoAt, iniciadoAt));
      if (iniciadoAt) {
        const horas = diffHoras(iniciadoAt, concluidoAt);
        temposInicioConclusao.push(horas);
        const tipo = servico?.tipo ?? "—";
        if (!temposPorTipo.has(tipo)) temposPorTipo.set(tipo, []);
        temposPorTipo.get(tipo)!.push(horas);
      }
    }

    if (validadoAt && emRange(validadoAt) && concluidoAt) {
      temposFechoValidacao.push(diffHoras(concluidoAt, validadoAt));
    }
    if (faturadoAt && emRange(faturadoAt)) {
      if (validadoAt) temposValidacaoFaturacao.push(diffHoras(validadoAt, faturadoAt));
      if (pedido?.created_at) temposPedidoFaturacao.push(diffHoras(pedido.created_at, faturadoAt));
    }
    if (liquidadoAt && emRange(liquidadoAt) && faturadoAt) {
      temposFaturacaoLiquidacao.push(diffHoras(faturadoAt, liquidadoAt));
    }
  }

  // Pedido → orçamento: independente de o serviço já ter sido concluído —
  // o que importa aqui é apenas quando o orçamento foi criado.
  const temposPedidoOrcamento: number[] = [];
  for (const b of budgets ?? []) {
    if (!b.criado_em || !emRange(b.criado_em)) continue;
    const pedido = (b as any).request_id ? requestPorId.get((b as any).request_id) : null;
    if (pedido?.created_at) temposPedidoOrcamento.push(diffHoras(pedido.created_at, b.criado_em));
  }

  const media = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  // --- Valores (composição dos orçamentos criados no período) ---
  const valores = { materiais: 0, mao_obra: 0, deslocacao: 0 };
  for (const b of budgets ?? []) {
    if (!b.criado_em || !emRange(b.criado_em)) continue;
    for (const item of (b as any).budget_items ?? []) {
      const total = Number(item.qtd ?? 0) * Number(item.valor_unit ?? 0);
      if (item.tipo === "materiais") valores.materiais += total;
      else if (item.tipo === "mao_obra") valores.mao_obra += total;
      else if (item.tipo === "deslocacao") valores.deslocacao += total;
    }
  }

  return {
    faturacao: { totalFaturado, totalPorFaturar, totalPorReceber, totalRecebido, nFaturados, nLiquidados, valorMedio },
    producao: {
      concluidos: concluidosNoRange.length,
      pendentes,
      porTipo: Object.fromEntries(porTipoCount),
      servicoMaisRealizado,
      novasVisitas: novaVisitaNoRange.length,
      naoRealizados: naoRealizadoNoRange.length,
      orcamentos: orcamentosNoRange.length,
    },
    tempos: {
      pedidoOrcamentoHoras: media(temposPedidoOrcamento),
      pedidoAgendamentoHoras: media(temposPedidoAgendamento),
      pedidoConclusaoHoras: media(temposPedidoConclusao),
      agendamentoInicioHoras: media(temposAgendamentoInicio),
      inicioConclusaoHoras: media(temposInicioConclusao),
      fechoValidacaoHoras: media(temposFechoValidacao),
      validacaoFaturacaoHoras: media(temposValidacaoFaturacao),
      pedidoFaturacaoHoras: media(temposPedidoFaturacao),
      faturacaoLiquidacaoHoras: media(temposFaturacaoLiquidacao),
      porTipoHoras: Object.fromEntries([...temposPorTipo].map(([k, v]) => [k, media(v)])),
    },
    valores,
  };
}
