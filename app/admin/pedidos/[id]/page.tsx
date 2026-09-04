import Link from "next/link";
import { notFound } from "next/navigation";
import { obterDetalhePedido, arquivarPedido, converterEmOrcamento, resolverInfoPedido } from "../actions";
import { PedidoDetalheConteudo } from "@/components/pedidos/PedidoDetalheConteudo";

export default async function PedidoDetalhePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const detalhe = await obterDetalhePedido(params.id);
  if (!detalhe) notFound();
  const { pedido } = detalhe;
  const temAcoes = pedido.info_falta || pedido.estado === "novo";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/pedidos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Pedidos
      </Link>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <PedidoDetalheConteudo
          detalhe={detalhe}
          acoes={
            !temAcoes ? undefined : (
              <>
                {pedido.info_falta && (
                  <form action={resolverInfoPedido} className="flex gap-2">
                    <input type="hidden" name="id" value={pedido.id} />
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

                {pedido.estado === "novo" && (
                  <div className="mt-2 flex gap-2">
                    <form action={converterEmOrcamento}>
                      <input type="hidden" name="id" value={pedido.id} />
                      <input type="hidden" name="client_id" value={pedido.client_id} />
                      <button className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
                        Converter em orçamento
                      </button>
                    </form>
                    <form action={arquivarPedido}>
                      <input type="hidden" name="id" value={pedido.id} />
                      <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800">
                        Arquivar
                      </button>
                    </form>
                  </div>
                )}
              </>
            )
          }
        />
      </div>
    </div>
  );
}
