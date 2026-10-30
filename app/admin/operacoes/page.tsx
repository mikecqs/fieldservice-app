export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { estadoOperacionalPedido } from "@/lib/pedido-estado";
import { OperacoesPipeline, type LinhaOperacao, type ServicoResumo } from "./OperacoesPipeline";

// Centro de Operações (Fase A) — uma linha por trabalho, com o percurso
// completo Pedido → Orçamento → Serviço, em vez de três listas separadas.
// Só leitura + navegação: todas as ações continuam nas páginas/fluxos
// existentes (nenhuma regra de estado nova, nenhuma escrita aqui). As
// páginas antigas (Pedidos/Orçamentos/Serviços) continuam intactas.
export default async function OperacoesPage() {
  const supabase = await createClient();

  const [{ data: pedidos }, { data: budgets }, { data: services }] = await Promise.all([
    supabase
      .from("requests")
      .select("id, codigo, tipo, descricao, info_falta, estado, created_at, clients(nome)")
      .order("created_at", { ascending: false }),
    supabase.from("budgets").select("id, estado, request_id, created_at, clients(nome)"),
    supabase
      .from("services")
      .select(
        "id, estado, tipo, descricao, request_id, budget_id, data_agendada, hora_agendada, created_at, clients(nome), service_technicians(profiles(nome))"
      ),
  ]);

  const resumoServico = (s: any): ServicoResumo => ({
    id: s.id,
    estado: s.estado,
    tipo: s.tipo,
    data: s.data_agendada ?? null,
    hora: s.hora_agendada ? String(s.hora_agendada).slice(0, 5) : null,
    tecnicos: (s.service_technicians ?? []).map((t: any) => t.profiles?.nome).filter(Boolean),
  });

  const budgetPorPedido = new Map<string, any>();
  const budgetsSemPedido: any[] = [];
  for (const b of (budgets ?? []) as any[]) {
    if (b.request_id) budgetPorPedido.set(b.request_id, b);
    else budgetsSemPedido.push(b);
  }
  const idsBudgetSemPedido = new Set(budgetsSemPedido.map((b) => b.id));

  const servicosPorPedido = new Map<string, any[]>();
  const servicosPorBudgetSemPedido = new Map<string, any[]>();
  const servicosSoltos: any[] = [];
  for (const s of (services ?? []) as any[]) {
    if (s.request_id) {
      servicosPorPedido.set(s.request_id, [...(servicosPorPedido.get(s.request_id) ?? []), s]);
    } else if (s.budget_id && idsBudgetSemPedido.has(s.budget_id)) {
      servicosPorBudgetSemPedido.set(s.budget_id, [...(servicosPorBudgetSemPedido.get(s.budget_id) ?? []), s]);
    } else {
      servicosSoltos.push(s);
    }
  }

  const linhas: LinhaOperacao[] = [];

  for (const p of (pedidos ?? []) as any[]) {
    const b = budgetPorPedido.get(p.id);
    const ss = servicosPorPedido.get(p.id) ?? [];
    linhas.push({
      chave: `p:${p.id}`,
      pedidoId: p.id,
      codigo: p.codigo,
      cliente: p.clients?.nome ?? "—",
      tipo: p.tipo,
      descricao: p.descricao,
      infoFalta: p.info_falta,
      criadoEm: p.created_at,
      orcamento: b ? { id: b.id, estado: b.estado } : null,
      servicos: ss.map(resumoServico),
      estado: estadoOperacionalPedido(p, b, ss),
    });
  }

  // Orçamentos e serviços criados sem Pedido (dados antigos ou criação
  // direta) também entram — nada pode ficar invisível nesta vista.
  for (const b of budgetsSemPedido) {
    const ss = servicosPorBudgetSemPedido.get(b.id) ?? [];
    linhas.push({
      chave: `b:${b.id}`,
      pedidoId: null,
      codigo: null,
      cliente: b.clients?.nome ?? "—",
      tipo: "Orçamento",
      descricao: null,
      infoFalta: false,
      criadoEm: b.created_at,
      orcamento: { id: b.id, estado: b.estado },
      servicos: ss.map(resumoServico),
      estado: estadoOperacionalPedido({ estado: "orcamento", info_falta: false }, b, ss),
    });
  }
  for (const s of servicosSoltos) {
    linhas.push({
      chave: `s:${s.id}`,
      pedidoId: null,
      codigo: null,
      cliente: s.clients?.nome ?? "—",
      tipo: s.tipo,
      descricao: s.descricao,
      infoFalta: false,
      criadoEm: s.created_at,
      orcamento: null,
      servicos: [resumoServico(s)],
      estado: estadoOperacionalPedido({ estado: "convertido", info_falta: false }, undefined, [s]),
    });
  }

  linhas.sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Operações</h1>
          <p className="mt-0.5 text-sm text-muted">Todo o trabalho num só sítio — do pedido ao serviço.</p>
        </div>
        <Link
          href="/admin/pedidos/novo"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Novo pedido
        </Link>
      </div>
      <OperacoesPipeline linhas={linhas} />
    </div>
  );
}
