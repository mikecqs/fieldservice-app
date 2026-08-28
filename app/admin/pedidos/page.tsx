import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { arquivarPedido, converterEmOrcamento, resolverInfoPedido } from "./actions";
import { estadoOperacionalPedido } from "@/lib/pedido-estado";

export default async function PedidosPage() {
  const supabase = createClient();
  const { data: pedidos } = await supabase
    .from("requests")
    .select("id, tipo, descricao, origem, info_falta, estado, created_at, clients(id, nome)")
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

      <div className="space-y-3">
        {(pedidos ?? []).map((p: any) => {
          const estadoOperacional = estadoOperacionalPedido(p, budgetPorPedido.get(p.id), servicePorPedido.get(p.id));
          return (
          <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-100">{p.clients?.nome}</span>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                    {p.tipo}
                  </span>
                  {p.info_falta && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      Falta info
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-300">{p.descricao}</p>
                {p.origem && <p className="mt-1 text-xs text-neutral-500">Origem: {p.origem}</p>}
              </div>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${estadoOperacional.cls}`}>
                {estadoOperacional.label}
              </span>
            </div>

            {p.info_falta && (
              <form action={resolverInfoPedido} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="info_adicional"
                  placeholder="Informação que faltava (opcional, é acrescentada à descrição)"
                  className="flex-1 rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
                />
                <button className="shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
                  Marcar info completa
                </button>
              </form>
            )}

            {p.estado === "novo" && (
              <div className="mt-3 flex gap-2">
                <form action={converterEmOrcamento}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="client_id" value={p.clients?.id} />
                  <button className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
                    Converter em orçamento
                  </button>
                </form>
                <form action={arquivarPedido}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800">
                    Arquivar
                  </button>
                </form>
              </div>
            )}
          </div>
          );
        })}
        {(pedidos ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">Ainda sem pedidos.</p>
        )}
      </div>
    </div>
  );
}
