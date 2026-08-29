"use client";

import { useState } from "react";
import { PedidoModal } from "@/components/pedidos/PedidoModal";

const ESTADO_PEDIDO_LABEL: Record<string, string> = {
  novo: "Novo",
  orcamento: "Em orçamento",
  convertido: "Convertido",
  arquivado: "Arquivado",
};

type PedidoResumo = { id: string; codigo: string; tipo: string; descricao: string; estado: string; created_at: string };

// Lista compacta (não texto corrido) — o código PED-000001 abre o mesmo
// PedidoModal já usado em /admin/pedidos, nunca um segundo sistema de
// detalhe de pedidos.
export function PedidosCompactos({ pedidos }: { pedidos: PedidoResumo[] }) {
  const [modalId, setModalId] = useState<string | null>(null);

  if (pedidos.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Pedidos · {pedidos.length}</h3>
      <div className="space-y-1.5">
        {pedidos.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-2.5 text-sm">
            <button
              type="button"
              onClick={() => setModalId(p.id)}
              className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300 hover:bg-neutral-700"
            >
              {p.codigo}
            </button>
            <span className="min-w-0 flex-1 truncate text-neutral-300">{p.descricao}</span>
            <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{p.tipo}</span>
            <span className="shrink-0 text-xs text-neutral-500">{ESTADO_PEDIDO_LABEL[p.estado] ?? p.estado}</span>
            <span className="shrink-0 text-xs text-neutral-600">{new Date(p.created_at).toLocaleDateString("pt-PT")}</span>
          </div>
        ))}
      </div>

      {modalId && <PedidoModal id={modalId} onClose={() => setModalId(null)} />}
    </div>
  );
}
