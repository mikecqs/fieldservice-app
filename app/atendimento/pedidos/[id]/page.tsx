import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estadoOperacionalPedido } from "@/lib/pedido-estado";

// Detalhe do pedido para ATENDIMENTO — `requests` mais a view segura
// `requests_status_atendimento_view` (só o `estado` de orçamento/serviço,
// nunca valor/iva/faturação — ver comentário em schema.sql). Mesmo rótulo
// que o Admin usa (estadoOperacionalPedido), nunca um segundo sistema de
// estado. Não mostra orçamento nem serviço em si (tabelas administrativas,
// fora do alcance desta role), só o percurso resumido do próprio pedido.
export default async function AtendimentoPedidoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: pedido } = await supabase
    .from("requests")
    .select(
      "id, codigo, tipo, descricao, origem, estado, info_falta, created_at, clients(nome, telefone, email), client_addresses(label, endereco)"
    )
    .eq("id", params.id)
    .single();

  if (!pedido) notFound();

  const { data: estadoLinha } = await supabase
    .from("requests_status_atendimento_view")
    .select("orcamento_estado, servico_estado")
    .eq("request_id", pedido.id)
    .maybeSingle();

  const budget = estadoLinha?.orcamento_estado ? { estado: estadoLinha.orcamento_estado } : undefined;
  const service = estadoLinha?.servico_estado ? { estado: estadoLinha.servico_estado } : undefined;
  const estado = estadoOperacionalPedido(pedido, budget, service);

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/atendimento/pedidos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Pedidos
      </Link>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                {pedido.codigo}
              </span>
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                {pedido.tipo}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-bold text-white">{(pedido as any).clients?.nome}</h1>
            <p className="text-xs text-neutral-500">
              {(pedido as any).clients?.telefone} {(pedido as any).clients?.email ? `· ${(pedido as any).clients?.email}` : ""}
            </p>
          </div>
          <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${estado.cls}`}>{estado.label}</span>
        </div>

        <div className="mb-3 rounded-md bg-neutral-800 p-3 text-sm text-neutral-300">
          <div className="mb-1 text-[10px] font-semibold uppercase text-neutral-500">Morada</div>
          {(pedido as any).client_addresses
            ? `${(pedido as any).client_addresses.label}: ${(pedido as any).client_addresses.endereco}`
            : "—"}
        </div>

        <p className="mb-2 text-sm text-neutral-200">{pedido.descricao}</p>
        <p className="text-xs text-neutral-500">
          Origem: {pedido.origem} · Criado em {new Date(pedido.created_at).toLocaleString("pt-PT")}
        </p>
      </div>
    </div>
  );
}
