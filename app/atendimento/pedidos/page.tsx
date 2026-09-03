import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { estadoOperacionalPedido } from "@/lib/pedido-estado";

// ATENDIMENTO só lê a própria tabela `requests` (ver policy "atendimento
// reads requests" em schema.sql) mais a view segura
// `requests_status_atendimento_view`, que devolve só o `estado` (texto) do
// orçamento/serviço ligado a cada pedido — nunca valor, iva, materiais ou
// faturação. O rótulo E o agrupamento (para ordenar concluídos para o fim)
// reutilizam sempre a mesma função do Admin (estadoOperacionalPedido) —
// antes esta página ordenava por requests.estado diretamente ('convertido'/
// 'arquivado'), que não reflete o progresso real do Orçamento/Serviço
// ligado (um pedido em 'orcamento' cujo Serviço já está concluído ficava
// preso no topo; um pedido já 'convertido' mas ainda por agendar caía logo
// para o fim) — mesmo bug já corrigido em PedidosLista.tsx (Admin).
export default async function AtendimentoPedidosPage() {
  const supabase = createClient();
  const { data: pedidos } = await supabase
    .from("requests")
    .select("id, codigo, tipo, descricao, origem, estado, info_falta, created_at, clients(nome), client_addresses(label, endereco)")
    .order("created_at", { ascending: false });

  const pedidoIds = (pedidos ?? []).map((p) => p.id);
  const { data: estados } =
    pedidoIds.length > 0
      ? await supabase
          .from("requests_status_atendimento_view")
          .select("request_id, orcamento_estado, servico_estado")
          .in("request_id", pedidoIds)
      : { data: [] as any[] };

  const estadoPorPedido = new Map((estados ?? []).map((e: any) => [e.request_id, e]));

  const comEstado = (pedidos ?? []).map((p: any) => {
    const e = estadoPorPedido.get(p.id);
    const budget = e?.orcamento_estado ? { estado: e.orcamento_estado } : undefined;
    // A view já devolve no máximo um Serviço por pedido (ver
    // requests_status_atendimento_view em schema.sql); envolve-se num
    // array só para bater certo com a assinatura partilhada com o Admin,
    // que já lida com mais do que um.
    const services = e?.servico_estado ? [{ estado: e.servico_estado }] : [];
    return { pedido: p, estado: estadoOperacionalPedido(p, budget, services) };
  });

  const pedidosOrdenados = [...comEstado].sort((a, b) => {
    const aConcluido = a.estado.grupo === "concluido";
    const bConcluido = b.estado.grupo === "concluido";
    if (aConcluido === bConcluido) return 0;
    return aConcluido ? 1 : -1;
  });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pedidos</h1>
          <p className="mt-0.5 text-sm text-neutral-400">Pedidos criados no atendimento à loja.</p>
        </div>
        <Link
          href="/atendimento/pedidos/novo"
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Novo pedido
        </Link>
      </div>

      <div className="space-y-3">
        {pedidosOrdenados.map(({ pedido: p, estado }) => {
          return (
            <Link
              key={p.id}
              href={`/atendimento/pedidos/${p.id}`}
              className="block rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600"
            >
              <div className="mb-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                      {p.codigo}
                    </span>
                    <span className="font-medium text-neutral-100">{p.clients?.nome}</span>
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                      {p.tipo}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-300">{p.descricao}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Origem: {p.origem}
                    {p.client_addresses?.endereco ? ` · ${p.client_addresses.endereco}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${estado.cls}`}>{estado.label}</span>
              </div>
            </Link>
          );
        })}
        {pedidosOrdenados.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">Ainda sem pedidos.</p>
        )}
      </div>
    </div>
  );
}
