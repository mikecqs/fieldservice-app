import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { arquivarPedido, converterEmOrcamento, resolverInfoPedido } from "./actions";

const ESTADO_LABEL: Record<string, string> = {
  novo: "Novo",
  orcamento: "Em orçamento",
  convertido: "Convertido",
  arquivado: "Arquivado",
};

export default async function PedidosPage() {
  const supabase = createClient();
  const { data: pedidos } = await supabase
    .from("requests")
    .select("id, tipo, descricao, origem, info_falta, estado, created_at, clients(id, nome)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pedidos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Pedidos recebidos de clientes, antes de se tornarem orçamento ou serviço.
          </p>
        </div>
        <Link
          href="/admin/pedidos/novo"
          className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800"
        >
          Novo pedido
        </Link>
      </div>

      <div className="space-y-3">
        {(pedidos ?? []).map((p: any) => (
          <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{p.clients?.nome}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {p.tipo}
                  </span>
                  {p.info_falta && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      Falta info
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{p.descricao}</p>
                {p.origem && <p className="mt-1 text-xs text-slate-400">Origem: {p.origem}</p>}
              </div>
              <span className="shrink-0 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {ESTADO_LABEL[p.estado] ?? p.estado}
              </span>
            </div>

            {p.info_falta && (
              <form action={resolverInfoPedido} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="info_adicional"
                  placeholder="Informação que faltava (opcional, é acrescentada à descrição)"
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
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
                  <button className="rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">
                    Converter em orçamento
                  </button>
                </form>
                <form action={arquivarPedido}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                    Arquivar
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
        {(pedidos ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Ainda sem pedidos.</p>
        )}
      </div>
    </div>
  );
}
