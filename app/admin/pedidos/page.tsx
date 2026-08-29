import Link from "next/link";
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
          supabase.from("services").select("estado, request_id").in("request_id", pedidoIds),
        ])
      : [{ data: [] }, { data: [] }];

  const budgetPorPedido = new Map((budgets ?? []).map((b: any) => [b.request_id, b]));
  const servicePorPedido = new Map((services ?? []).map((s: any) => [s.request_id, s]));

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
    estadoOperacional: estadoOperacionalPedido(p, budgetPorPedido.get(p.id), servicePorPedido.get(p.id)),
  }));

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pedidos</h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            Pedidos recebidos de clientes, antes de se tornarem orçamento ou serviço.
          </p>
        </div>
        <Link
          href="/admin/pedidos/novo"
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Novo pedido
        </Link>
      </div>

      <PedidosLista pedidos={resumo} />
    </div>
  );
}
