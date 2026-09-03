import { createClient } from "@/lib/supabase/server";
import { rotuloTipoServico } from "@/lib/servico-estado";

const HORAS_MAO_OBRA: Record<string, number> = {
  "1h": 1, "2h": 2, "3h": 3, "4h": 4, "5h": 5, "6h": 6, "7h": 7, "8h": 8,
  dia_completo: 8, "2dias": 16, outro: 0,
};

function diffHoras(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}
function media(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

type SB = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// Pontos de atenção — sinais complementares à Central de Atenção (não
// duplica a página inteira, só um resumo de contagens com link para lá).
// ---------------------------------------------------------------------------
export async function getPontosAtencao(supabase: SB, organizationId?: string) {
  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);
  const hoje = toISO(new Date());

  const [{ data: servicos }, { data: budgets }] = await Promise.all([
    withOrg(supabase.from("services").select("id, estado, data_agendada, faturacao_estado")),
    withOrg(supabase.from("budgets").select("id, estado, followup_em")),
  ]);

  const atrasados = (servicos ?? []).filter(
    (s) => s.data_agendada && s.data_agendada < hoje && !["concluido", "cancelado", "nao_realizado", "aguarda_validacao"].includes(s.estado)
  ).length;
  const fechadosSemFaturar = (servicos ?? []).filter((s) => s.estado === "concluido" && s.faturacao_estado === "por_faturar").length;
  const novaVisita = (servicos ?? []).filter((s) => s.estado === "nova_visita").length;
  const orcamentosSemResposta = (budgets ?? []).filter(
    (b) => ["aguarda_resposta", "enviado", "followup"].includes(b.estado) && b.followup_em && b.followup_em <= hoje
  ).length;

  return { atrasados, fechadosSemFaturar, novaVisita, orcamentosSemResposta };
}

// ---------------------------------------------------------------------------
// Evolução — série temporal diária para o gráfico de linha.
// ---------------------------------------------------------------------------
export async function getEvolucao(supabase: SB, desde: string, ate: string, organizationId?: string) {
  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);

  const [{ data: eventos }, { data: budgets }] = await Promise.all([
    withOrg(supabase.from("service_events").select("tipo, created_at, service_id")),
    withOrg(supabase.from("budgets").select("id, criado_em")),
  ]);
  // 'liquidado' inclui-se aqui também — mesma semântica de totalFaturado em
  // lib/financeiro.ts (faturado é sempre um sobreconjunto de liquidado,
  // nunca o oposto).
  const { data: servicosFaturados } = await (organizationId
    ? supabase.from("services").select("faturacao_data, faturacao_valor").eq("organization_id", organizationId)
    : supabase.from("services").select("faturacao_data, faturacao_valor")
  ).in("faturacao_estado", ["faturado", "liquidado"]);

  const dias: string[] = [];
  for (let d = new Date(desde); toISO(d) <= ate; d.setDate(d.getDate() + 1)) dias.push(toISO(d));

  const porDia = new Map<string, { servicos: number; faturacao: number; orcamentos: number }>();
  for (const d of dias) porDia.set(d, { servicos: 0, faturacao: 0, orcamentos: 0 });

  for (const e of eventos ?? []) {
    const dia = e.created_at.slice(0, 10);
    if (e.tipo === "concluido" && porDia.has(dia)) porDia.get(dia)!.servicos++;
  }
  for (const b of budgets ?? []) {
    if (b.criado_em && porDia.has(b.criado_em)) porDia.get(b.criado_em)!.orcamentos++;
  }
  for (const s of servicosFaturados ?? []) {
    if (s.faturacao_data && porDia.has(s.faturacao_data)) porDia.get(s.faturacao_data)!.faturacao += Number(s.faturacao_valor ?? 0);
  }

  return dias.map((d) => ({ dia: d, ...porDia.get(d)! }));
}

// ---------------------------------------------------------------------------
// Técnicos — serviços concluídos, horas (via mao_obra_tipo, nunca inventadas
// a partir de deltas de relógio, para bater certo com o valor faturável),
// tempo médio, novas visitas.
// ---------------------------------------------------------------------------
export async function getTecnicos(supabase: SB, desde: string, ate: string, organizationId?: string) {
  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);

  const [{ data: tecnicos }, { data: eventos }, { data: visits }] = await Promise.all([
    withOrg(supabase.from("profiles").select("id, nome")).eq("role", "TECHNICIAN"),
    withOrg(supabase.from("service_events").select("service_id, tipo, created_at")),
    withOrg(supabase.from("visits").select("service_id, mao_obra_tipo, resultado, created_by, created_at")),
  ]);

  const servicoTecnicos = new Map<string, Set<string>>();
  const { data: assocs } = await supabase
    .from("service_technicians")
    .select("service_id, user_id, services!inner(organization_id)")
    .then((r) => r as any);
  for (const a of assocs ?? []) {
    if (organizationId && a.services?.organization_id !== organizationId) continue;
    if (!servicoTecnicos.has(a.service_id)) servicoTecnicos.set(a.service_id, new Set());
    servicoTecnicos.get(a.service_id)!.add(a.user_id);
  }

  const emRange = (iso: string) => iso.slice(0, 10) >= desde && iso.slice(0, 10) <= ate;
  const concluidoAt = new Map<string, string>();
  for (const e of eventos ?? []) {
    if (e.tipo === "concluido" && emRange(e.created_at)) concluidoAt.set(e.service_id, e.created_at);
  }
  const iniciadoAt = new Map<string, string>();
  for (const e of eventos ?? []) {
    if ((e.tipo === "iniciado" || e.tipo === "corrigido") && !iniciadoAt.has(e.service_id)) iniciadoAt.set(e.service_id, e.created_at);
  }

  const porTecnico = new Map<string, { nome: string; concluidos: number; horas: number; temposFecho: number[]; novasVisitas: number }>();
  for (const t of tecnicos ?? []) porTecnico.set(t.id, { nome: t.nome, concluidos: 0, horas: 0, temposFecho: [], novasVisitas: 0 });

  for (const [serviceId, quando] of concluidoAt) {
    const userIds = servicoTecnicos.get(serviceId);
    if (!userIds) continue;
    const inicio = iniciadoAt.get(serviceId);
    for (const uid of userIds) {
      const entry = porTecnico.get(uid);
      if (!entry) continue;
      entry.concluidos++;
      if (inicio) entry.temposFecho.push(diffHoras(inicio, quando));
    }
  }

  for (const v of visits ?? []) {
    if (!v.created_at || !emRange(v.created_at)) continue;
    const entry = v.created_by ? porTecnico.get(v.created_by) : null;
    if (!entry) continue;
    entry.horas += HORAS_MAO_OBRA[v.mao_obra_tipo ?? ""] ?? 0;
    if (v.resultado === "nova_visita") entry.novasVisitas++;
  }

  return Array.from(porTecnico.values())
    .map((t) => ({ nome: t.nome, concluidos: t.concluidos, horas: t.horas, tempoMedioHoras: media(t.temposFecho), novasVisitas: t.novasVisitas }))
    .filter((t) => t.concluidos > 0 || t.horas > 0 || t.novasVisitas > 0)
    .sort((a, b) => b.concluidos - a.concluidos);
}

// ---------------------------------------------------------------------------
// Tipos de serviço — quantidade, tempo médio, valor médio, mão de obra,
// materiais (tudo ancorado em serviços concluídos no período).
// ---------------------------------------------------------------------------
export async function getTiposServico(supabase: SB, desde: string, ate: string, organizationId?: string) {
  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);

  const [{ data: eventos }, { data: servicos }, { data: visits }] = await Promise.all([
    withOrg(supabase.from("service_events").select("service_id, tipo, created_at")),
    withOrg(supabase.from("services").select("id, tipo, valor")),
    withOrg(supabase.from("visits").select("id, service_id, mao_obra_tipo")),
  ]);

  const emRange = (iso: string) => iso.slice(0, 10) >= desde && iso.slice(0, 10) <= ate;
  const concluidosNoRange = new Set((eventos ?? []).filter((e) => e.tipo === "concluido" && emRange(e.created_at)).map((e) => e.service_id));
  const servicoPorId = new Map((servicos ?? []).map((s) => [s.id, s]));

  const iniciadoAt = new Map<string, string>();
  const concluidoAt = new Map<string, string>();
  for (const e of eventos ?? []) {
    if ((e.tipo === "iniciado" || e.tipo === "corrigido") && !iniciadoAt.has(e.service_id)) iniciadoAt.set(e.service_id, e.created_at);
    if (e.tipo === "concluido") concluidoAt.set(e.service_id, e.created_at);
  }

  const visitIdParaServico = new Map((visits ?? []).map((v) => [v.id, v.service_id]));
  const { data: materiaisUsados } = await supabase
    .from("visit_materials_used")
    .select("visit_id, qtd, preco_unit");

  const materiaisPorServico = new Map<string, number>();
  for (const m of materiaisUsados ?? []) {
    const serviceId = visitIdParaServico.get(m.visit_id);
    if (!serviceId || !concluidosNoRange.has(serviceId)) continue;
    materiaisPorServico.set(serviceId, (materiaisPorServico.get(serviceId) ?? 0) + Number(m.qtd) * Number(m.preco_unit));
  }
  const maoObraPorServico = new Map<string, number>();
  for (const v of visits ?? []) {
    if (!concluidosNoRange.has(v.service_id)) continue;
    maoObraPorServico.set(v.service_id, (maoObraPorServico.get(v.service_id) ?? 0) + (HORAS_MAO_OBRA[v.mao_obra_tipo ?? ""] ?? 0));
  }

  const porTipo = new Map<
    string,
    { quantidade: number; tempos: number[]; valores: number[]; horasMaoObra: number; materiais: number }
  >();
  for (const serviceId of concluidosNoRange) {
    const servico = servicoPorId.get(serviceId);
    if (!servico) continue;
    if (!porTipo.has(servico.tipo)) porTipo.set(servico.tipo, { quantidade: 0, tempos: [], valores: [], horasMaoObra: 0, materiais: 0 });
    const entry = porTipo.get(servico.tipo)!;
    entry.quantidade++;
    const inicio = iniciadoAt.get(serviceId);
    const fim = concluidoAt.get(serviceId);
    if (inicio && fim) entry.tempos.push(diffHoras(inicio, fim));
    if (servico.valor) entry.valores.push(Number(servico.valor));
    entry.horasMaoObra += maoObraPorServico.get(serviceId) ?? 0;
    entry.materiais += materiaisPorServico.get(serviceId) ?? 0;
  }

  return Array.from(porTipo.entries())
    .map(([tipo, v]) => ({
      tipo: rotuloTipoServico(tipo),
      quantidade: v.quantidade,
      tempoMedioHoras: media(v.tempos),
      valorMedio: v.valores.length ? v.valores.reduce((a, b) => a + b, 0) / v.valores.length : null,
      maoObraHoras: v.horasMaoObra,
      materiaisValor: v.materiais,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

// ---------------------------------------------------------------------------
// Orçamentos — funil completo.
// ---------------------------------------------------------------------------
export async function getOrcamentosFunil(supabase: SB, desde: string, ate: string, organizationId?: string) {
  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);
  const hoje = toISO(new Date());

  const [{ data: budgets }, { data: eventos }] = await Promise.all([
    withOrg(supabase.from("budgets").select("id, estado, criado_em, followup_em, iva_percent, budget_items(qtd, valor_unit)")),
    withOrg(supabase.from("budget_events").select("budget_id, tipo, created_at")),
  ]);

  const criadosNoRange = (budgets ?? []).filter((b) => b.criado_em && b.criado_em >= desde && b.criado_em <= ate);
  const totalCriado = criadosNoRange.reduce(
    (acc, b) => acc + ((b as any).budget_items ?? []).reduce((a: number, i: any) => a + Number(i.qtd) * Number(i.valor_unit), 0) * (1 + Number(b.iva_percent) / 100),
    0
  );

  const enviados = (eventos ?? []).filter((e) => e.tipo === "enviado" && e.created_at.slice(0, 10) >= desde && e.created_at.slice(0, 10) <= ate).length;
  const aceitesEventos = (eventos ?? []).filter((e) => e.tipo === "aceite" && e.created_at.slice(0, 10) >= desde && e.created_at.slice(0, 10) <= ate);
  const recusadosEventos = (eventos ?? []).filter((e) => e.tipo === "recusado" && e.created_at.slice(0, 10) >= desde && e.created_at.slice(0, 10) <= ate);

  const budgetPorId = new Map((budgets ?? []).map((b) => [b.id, b]));
  const valorDoBudget = (b: any) =>
    (b.budget_items ?? []).reduce((a: number, i: any) => a + Number(i.qtd) * Number(i.valor_unit), 0) * (1 + Number(b.iva_percent) / 100);

  const valorAceite = aceitesEventos.reduce((acc, e) => {
    const b = budgetPorId.get(e.budget_id);
    return acc + (b ? valorDoBudget(b) : 0);
  }, 0);

  const enviadoAt = new Map<string, string>();
  for (const e of eventos ?? []) if (e.tipo === "enviado" && !enviadoAt.has(e.budget_id)) enviadoAt.set(e.budget_id, e.created_at);
  const temposResposta: number[] = [];
  for (const e of [...aceitesEventos, ...recusadosEventos]) {
    const envio = enviadoAt.get(e.budget_id);
    if (envio) temposResposta.push(diffHoras(envio, e.created_at));
  }

  const pendentes = (budgets ?? []).filter((b) => ["aguarda_resposta", "enviado", "followup"].includes(b.estado)).length;
  const followupsPendentes = (budgets ?? []).filter(
    (b) => ["aguarda_resposta", "enviado", "followup"].includes(b.estado) && b.followup_em && b.followup_em <= hoje
  ).length;

  const totalRespondidos = aceitesEventos.length + recusadosEventos.length;
  const taxaAceitacao = totalRespondidos > 0 ? (aceitesEventos.length / totalRespondidos) * 100 : null;

  return {
    criados: criadosNoRange.length,
    enviados,
    aceites: aceitesEventos.length,
    recusados: recusadosEventos.length,
    pendentes,
    taxaAceitacao,
    valorTotal: totalCriado,
    valorAceite,
    tempoMedioRespostaHoras: media(temposResposta),
    followupsPendentes,
  };
}

// ---------------------------------------------------------------------------
// Materiais — mais utilizados, valor, por tipo de serviço, previsto vs
// utilizado (por nome — não há chave partilhada entre as duas tabelas).
// ---------------------------------------------------------------------------
export async function getMateriais(supabase: SB, desde: string, ate: string, organizationId?: string) {
  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);

  const { data: visits } = await withOrg(supabase.from("visits").select("id, service_id, data"));
  const visitIds = new Set((visits ?? []).filter((v) => v.data >= desde && v.data <= ate).map((v) => v.id));
  const visitServico = new Map((visits ?? []).map((v) => [v.id, v.service_id]));

  const { data: servicos } = await withOrg(supabase.from("services").select("id, tipo"));
  const tipoPorServico = new Map((servicos ?? []).map((s) => [s.id, s.tipo]));

  const { data: usados } = await supabase.from("visit_materials_used").select("visit_id, nome, qtd, preco_unit");
  const { data: previstos } = await withOrg(supabase.from("service_materials_planned").select("service_id, nome, qtd"));

  const porNome = new Map<string, { qtd: number; valor: number; porTipo: Map<string, number> }>();
  for (const u of usados ?? []) {
    if (!visitIds.has(u.visit_id)) continue;
    if (!porNome.has(u.nome)) porNome.set(u.nome, { qtd: 0, valor: 0, porTipo: new Map() });
    const entry = porNome.get(u.nome)!;
    entry.qtd += Number(u.qtd);
    entry.valor += Number(u.qtd) * Number(u.preco_unit);
    const tipo = tipoPorServico.get(visitServico.get(u.visit_id) ?? "") ?? "—";
    entry.porTipo.set(tipo, (entry.porTipo.get(tipo) ?? 0) + Number(u.qtd));
  }

  const previstoPorNome = new Map<string, number>();
  for (const p of previstos ?? []) previstoPorNome.set(p.nome, (previstoPorNome.get(p.nome) ?? 0) + Number(p.qtd));

  return Array.from(porNome.entries())
    .map(([nome, v]) => ({
      nome,
      qtdUtilizada: v.qtd,
      valor: v.valor,
      qtdPrevista: previstoPorNome.get(nome) ?? null,
      porTipo: Object.fromEntries(v.porTipo),
    }))
    .sort((a, b) => b.valor - a.valor);
}

// ---------------------------------------------------------------------------
// Agenda — ocupação. "Horas disponíveis" é uma estimativa (nº técnicos ×
// dias × 8h) por não existir configuração real de capacidade/turnos — nunca
// apresentada como dado exato, sempre com essa ressalva no UI.
// ---------------------------------------------------------------------------
export async function getAgenda(supabase: SB, desde: string, ate: string, organizationId?: string) {
  const withOrg = <T>(q: T): T => (organizationId ? ((q as any).eq("organization_id", organizationId) as T) : q);

  const [{ data: servicos }, { data: visits }, { data: tecnicos }, { data: eventos }] = await Promise.all([
    withOrg(supabase.from("services").select("id, data_agendada, hora_agendada, hora_fim_agendada")).gte("data_agendada", desde).lte("data_agendada", ate),
    withOrg(supabase.from("visits").select("mao_obra_tipo, data")),
    withOrg(supabase.from("profiles").select("id")).eq("role", "TECHNICIAN"),
    withOrg(supabase.from("service_events").select("tipo, created_at")),
  ]);

  let horasAgendadas = 0;
  for (const s of servicos ?? []) {
    if (!s.hora_agendada || !s.hora_fim_agendada) continue;
    const [h1, m1] = s.hora_agendada.split(":").map(Number);
    const [h2, m2] = s.hora_fim_agendada.split(":").map(Number);
    horasAgendadas += (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  }

  let horasTrabalhadas = 0;
  for (const v of visits ?? []) {
    if (v.data && v.data >= desde && v.data <= ate) horasTrabalhadas += HORAS_MAO_OBRA[v.mao_obra_tipo ?? ""] ?? 0;
  }

  const nDias = Math.max(1, Math.round((new Date(ate).getTime() - new Date(desde).getTime()) / 86_400_000) + 1);
  const horasDisponiveis = (tecnicos ?? []).length * nDias * 8;

  const reagendamentos = (eventos ?? []).filter((e) => e.tipo === "reagendado" && e.created_at.slice(0, 10) >= desde && e.created_at.slice(0, 10) <= ate).length;

  const { data: visitsComServico } = await withOrg(
    supabase.from("visits").select("hora_inicio_real, data, services!inner(hora_agendada, data_agendada)")
  );
  const iniciadosAtrasados = (visitsComServico ?? []).filter((v: any) => {
    if (!v.hora_inicio_real || !v.services?.hora_agendada || v.data < desde || v.data > ate) return false;
    return v.hora_inicio_real > v.services.hora_agendada;
  }).length;

  return {
    horasDisponiveis,
    horasAgendadas,
    horasTrabalhadas,
    taxaOcupacao: horasDisponiveis > 0 ? (horasTrabalhadas / horasDisponiveis) * 100 : null,
    iniciadosAtrasados,
    reagendamentos,
  };
}
