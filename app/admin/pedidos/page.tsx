import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { estadoOperacionalPedido } from "@/lib/pedido-estado";
import { PedidosLista, type PedidoResumo } from "./PedidosLista";

export default async function PedidosPage() {
  const supabase = createClient();
  const { data: pedidos } = await supabase
    .from("requests")
    .select("id, codigo, tipo, descricao, origem, info_falta, estado, created_at, clients(id, nome, codigo), client_addresses(label, endereco)")
    .order("created_at", { ascending: false });

  const pedidoIds = (pedidos ?? []).map((p) => p.id);
  const [{ data: budgets }, { data: services }] =
    pedidoIds.length > 0
      ? await Promise.all([
          supabase.from("budgets").select("estado, request_id").in("request_id", pedidoIds),
          supabase.from("services").select("estado, tipo, request_id").in("request_id", pedidoIds),
        ])
      : [{ data: [] }, { data: [] }];

  const budgetPorPedido = new Map((budgets ?? []).map((b: any) => [b.request_id, b]));

  // Agrupado (nunca um Map de "1 serviço por pedido") — a Visita Prévia
  // tornou normal um Pedido ter mais do que um Serviço ao longo do tempo
  // (Visita Prévia + Serviço de Instalação, por exemplo).
  const servicosPorPedido = new Map<string, any[]>();
  for (const s of (services ?? []) as any[]) {
    const lista = servicosPorPedido.get(s.request_id) ?? [];
    lista.push(s);
    servicosPorPedido.set(s.request_id, lista);
  }

  const resumo: PedidoResumo[] = (pedidos ?? []).map((p: any) => ({
    id: p.id,
    codigo: p.codigo,
    tipo: p.tipo,
    origem: p.origem,
    descricao: p.descricao,
    info_falta: p.info_falta,
    estado: p.estado,
    created_at: p.created_at,
    cliente: p.clients ? { id: p.clients.id, nome: p.clients.nome, codigo: p.clients.codigo } : null,
    morada: p.client_addresses?.endereco ?? null,
    estadoOperacional: estadoOperacionalPedido(p, budgetPorPedido.get(p.id), servicosPorPedido.get(p.id) ?? []),
  }));

  return (
    <div>
      <div className="mb-5 text-center">
        <h1 className="text-xl font-bold text-white">Pedidos</h1>
        <p className="mt-0.5 text-sm text-neutral-400">
          Pedidos recebidos de clientes, antes de se tornarem orçamento ou serviço.
        </p>
      </div>

      {/* Auditoria "Centralizar criação" — este é agora o único ponto de
          entrada visual para trabalho novo (Serviços e Orçamentos já não
          têm botão de criação próprio). Centrado e bem maior do que o resto
          da UI, para nunca passar despercebido; continua o branco já usado
          como "ação principal" em toda a app, sem inventar uma cor nova. */}
      <div className="mb-8 flex justify-center">
        <Link
          href="/admin/pedidos/novo"
          className="flex items-center gap-2 rounded-xl bg-white px-10 py-5 text-xl font-bold text-neutral-950 shadow-lg hover:bg-neutral-200"
        >
          <Plus className="h-6 w-6" aria-hidden="true" /> Novo Pedido
        </Link>
      </div>

      <PedidosLista pedidos={resumo} />
    </div>
  );
}
