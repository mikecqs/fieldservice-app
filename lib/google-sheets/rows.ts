import type { DataSheetName } from "./layout";

type Row = { sheet: DataSheetName; values: unknown[] };

const HORAS_MAO_OBRA_LABEL: Record<string, string> = {
  "1h": "1 hora", "2h": "2 horas", "3h": "3 horas", "4h": "4 horas", "5h": "5 horas",
  "6h": "6 horas", "7h": "7 horas", "8h": "8 horas", dia_completo: "Dia completo", "2dias": "2 dias completos", outro: "Outro",
};

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-PT");
}

// Todas as funções abaixo recebem o cliente admin (service role) e filtram
// SEMPRE explicitamente por organization_id — o service role ignora RLS, por
// isso este filtro é a única barreira real de isolamento entre empresas
// neste ficheiro. Nunca remover.
export async function shapeClient(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: c } = await admin
    .from("clients")
    .select("id, nome, empresa, nif, telefone, email, created_at, client_addresses(label, endereco)")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!c) return null;
  const moradas = (c.client_addresses ?? []).map((a: any) => `${a.label}: ${a.endereco}`).join(" | ");
  return [{
    sheet: "Clientes",
    values: [c.id, c.nome, c.empresa ?? "", c.nif ?? "", c.telefone ?? "", c.email ?? "", moradas, fmtDateTime(c.created_at), "Não"],
  }];
}

export async function shapeRequest(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: r } = await admin
    .from("requests")
    .select("id, tipo, descricao, origem, estado, info_falta, created_at, clients(nome)")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!r) return null;
  return [{
    sheet: "Pedidos",
    values: [r.id, r.clients?.nome ?? "", r.tipo, r.descricao, r.origem ?? "", r.estado, r.info_falta ? "Sim" : "Não", fmtDateTime(r.created_at)],
  }];
}

export async function shapeBudget(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: b } = await admin
    .from("budgets")
    .select("id, numero, estado, criado_em, enviado_em, followup_em, iva_percent, request_id, clients(nome), budget_items(qtd, valor_unit)")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!b) return null;
  const subtotal = (b.budget_items ?? []).reduce((acc: number, i: any) => acc + Number(i.qtd ?? 0) * Number(i.valor_unit ?? 0), 0);
  const total = subtotal * (1 + Number(b.iva_percent ?? 0) / 100);
  return [{
    sheet: "Orçamentos",
    values: [b.id, b.numero, b.clients?.nome ?? "", b.request_id ?? "", b.estado, b.criado_em ?? "", b.enviado_em ?? "", b.followup_em ?? "", b.iva_percent, total.toFixed(2)],
  }];
}

export async function shapeService(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: s } = await admin
    .from("services")
    .select(
      "id, tipo, descricao, estado, prioridade, valor, data_agendada, hora_agendada, hora_fim_agendada, request_id, budget_id, faturacao_estado, faturacao_valor, faturacao_data, faturacao_referencia, faturacao_metodo_pagamento, faturacao_liquidado_data, created_at, clients(nome), service_technicians(profiles(nome))"
    )
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!s) return null;
  const tecnicos = (s.service_technicians ?? []).map((t: any) => t.profiles?.nome).filter(Boolean).join(", ");
  const cliente = s.clients?.nome ?? "";

  return [
    {
      sheet: "Agendamentos",
      values: [s.id, cliente, s.tipo, tecnicos, s.data_agendada ?? "", s.hora_agendada?.slice(0, 5) ?? "", s.hora_fim_agendada?.slice(0, 5) ?? "", s.estado, s.prioridade],
    },
    {
      sheet: "Serviços",
      values: [
        s.id, cliente, s.tipo, s.descricao, s.estado, s.prioridade, tecnicos, s.data_agendada ?? "",
        s.hora_agendada?.slice(0, 5) ?? "", s.hora_fim_agendada?.slice(0, 5) ?? "", s.valor, s.faturacao_estado,
        s.request_id ?? "", s.budget_id ?? "", fmtDateTime(s.created_at),
      ],
    },
    {
      sheet: "Faturação",
      values: [
        s.id, cliente, s.faturacao_estado, s.faturacao_valor ?? "", s.faturacao_data ?? "", s.faturacao_referencia ?? "",
        s.faturacao_metodo_pagamento ?? "", s.faturacao_liquidado_data ?? "",
      ],
    },
  ];
}

export async function shapeVisit(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: v } = await admin
    .from("visits")
    .select(
      "id, service_id, data, hora_inicio_real, hora_fim_real, resultado, trabalho_realizado, mao_obra_tipo, valor_calculado, created_by, services(client_id, organization_id, clients(nome)), profiles(nome)"
    )
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!v) return null;
  return [{
    sheet: "Visitas",
    values: [
      v.id, v.service_id, v.services?.clients?.nome ?? "", v.data, v.hora_inicio_real?.slice(0, 5) ?? "", v.hora_fim_real?.slice(0, 5) ?? "",
      v.resultado ?? "", v.trabalho_realizado ?? "", HORAS_MAO_OBRA_LABEL[v.mao_obra_tipo ?? ""] ?? "", v.valor_calculado ?? "", v.profiles?.nome ?? "",
    ],
  }];
}

export async function shapeMaterialPlanned(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: m } = await admin
    .from("service_materials_planned")
    .select("id, service_id, nome, qtd, services!inner(organization_id, clients(nome))")
    .eq("services.organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!m) return null;
  return [{
    sheet: "Materiais",
    values: [m.id, "Previsto", m.service_id, "", m.services?.clients?.nome ?? "", m.nome, m.qtd, "", "", "Não"],
  }];
}

export async function shapeMaterialUsed(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: m } = await admin
    .from("visit_materials_used")
    .select("id, visit_id, nome, qtd, preco_unit, visits!inner(service_id, organization_id, services(clients(nome)))")
    .eq("visits.organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!m) return null;
  const valor = Number(m.qtd ?? 0) * Number(m.preco_unit ?? 0);
  return [{
    sheet: "Materiais",
    values: [m.id, "Utilizado", m.visits?.service_id ?? "", m.visit_id, m.visits?.services?.clients?.nome ?? "", m.nome, m.qtd, m.preco_unit, valor.toFixed(2), "Não"],
  }];
}

export async function shapeTechnician(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: p } = await admin
    .from("profiles")
    .select("id, nome, email")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .eq("role", "TECHNICIAN")
    .maybeSingle();
  if (!p) return null;
  return [{ sheet: "Técnicos", values: [p.id, p.nome, p.email, "Não"] }];
}

const HISTORICO_LABEL: Record<string, string> = {
  criado: "Criado", agendado: "Agendado", reagendado: "Reagendado", iniciado: "Iniciado", concluido: "Concluído",
  nova_visita: "Nova visita", nao_realizado: "Não realizado", correcao_pedida: "Correção pedida", corrigido: "Reaberto após correção",
  validado: "Validado", faturado: "Faturado", enviado: "Enviado", followup: "Follow-up", aceite: "Aceite", recusado: "Recusado", cancelado: "Cancelado",
  rejeitado: "Rejeitado",
};

export async function shapeServiceEvent(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: e } = await admin
    .from("service_events")
    .select("id, service_id, tipo, descricao, created_at, profiles(nome)")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!e) return null;
  return [{
    sheet: "Histórico",
    values: [e.id, fmtDateTime(e.created_at), "Serviço", e.service_id, HISTORICO_LABEL[e.tipo] ?? e.tipo, e.descricao, e.profiles?.nome ?? ""],
  }];
}

export async function shapeBudgetEvent(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: e } = await admin
    .from("budget_events")
    .select("id, budget_id, tipo, descricao, created_at, profiles(nome)")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!e) return null;
  return [{
    sheet: "Histórico",
    values: [e.id, fmtDateTime(e.created_at), "Orçamento", e.budget_id, HISTORICO_LABEL[e.tipo] ?? e.tipo, e.descricao, e.profiles?.nome ?? ""],
  }];
}

export async function shapeServiceValidation(admin: any, organizationId: string, entityId: string): Promise<Row[] | null> {
  const { data: e } = await admin
    .from("service_validations")
    .select("id, service_id, acao, motivo, created_at, profiles(nome)")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle();
  if (!e) return null;
  return [{
    sheet: "Histórico",
    values: [e.id, fmtDateTime(e.created_at), "Serviço", e.service_id, HISTORICO_LABEL[e.acao] ?? e.acao, e.motivo ?? "", e.profiles?.nome ?? ""],
  }];
}

export const SHAPERS: Record<string, (admin: any, organizationId: string, entityId: string) => Promise<Row[] | null>> = {
  client: shapeClient,
  request: shapeRequest,
  budget: shapeBudget,
  service: shapeService,
  visit: shapeVisit,
  material_planned: shapeMaterialPlanned,
  material_used: shapeMaterialUsed,
  technician: shapeTechnician,
  service_event: shapeServiceEvent,
  budget_event: shapeBudgetEvent,
  service_validation: shapeServiceValidation,
};
