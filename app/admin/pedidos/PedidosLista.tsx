"use client";

import { useMemo, useState } from "react";
import { arquivarPedido, converterEmOrcamento, resolverInfoPedido } from "./actions";
import { PedidoModal } from "@/components/pedidos/PedidoModal";
import type { GrupoPedido } from "@/lib/pedido-estado";

export type PedidoResumo = {
  id: string;
  codigo: string;
  tipo: string;
  origem: string;
  descricao: string;
  info_falta: boolean;
  estado: string;
  created_at: string;
  cliente: { id: string; nome: string; codigo?: string | null } | null;
  morada: string | null;
  estadoOperacional: { label: string; cls: string; grupo: GrupoPedido };
};

const GRUPO_INFO: Record<GrupoPedido, { titulo: string }> = {
  acao: { titulo: "Exigem ação" },
  andamento: { titulo: "Em andamento" },
  concluido: { titulo: "Concluídos / arquivados" },
};

// Caixa de entrada operacional dos Pedidos: pesquisa + 3 grupos por lógica
// operacional (exige ação → em andamento → concluído/arquivado no fim) +
// popup de consulta rápida (PedidoModal) sem sair da lista. As ações rápidas
// (marcar info completa / converter / arquivar) continuam disponíveis
// diretamente no cartão, exatamente como antes — só a consulta é que passou
// a abrir num popup em vez de navegar para outra página.
export function PedidosLista({ pedidos }: { pedidos: PedidoResumo[] }) {
  const [busca, setBusca] = useState("");
  const [modalId, setModalId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pedidos;
    return pedidos.filter((p) => {
      const alvo = [
        p.codigo,
        p.cliente?.nome,
        p.cliente?.codigo,
        p.tipo,
        p.origem,
        p.estadoOperacional.label,
        p.estado,
        p.descricao,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [pedidos, busca]);

  const grupos = useMemo(() => {
    const mapa: Record<GrupoPedido, PedidoResumo[]> = { acao: [], andamento: [], concluido: [] };
    for (const p of filtrados) mapa[p.estadoOperacional.grupo].push(p);
    return mapa;
  }, [filtrados]);

  return (
    <div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Pesquisar por código, cliente, tipo, origem ou estado…"
        className="mb-5 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
      />

      {pedidos.length === 0 && <p className="py-10 text-center text-sm text-neutral-500">Ainda sem pedidos.</p>}

      {pedidos.length > 0 && filtrados.length === 0 && (
        <p className="py-10 text-center text-sm text-neutral-500">Nenhum pedido corresponde à pesquisa.</p>
      )}

      <div className="space-y-6">
        {(["acao", "andamento", "concluido"] as GrupoPedido[]).map((g) =>
          grupos[g].length === 0 ? null : (
            <div key={g}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                {GRUPO_INFO[g].titulo} · {grupos[g].length}
              </h2>
              <div className="space-y-3">
                {grupos[g].map((p) => (
                  <PedidoCard key={p.id} pedido={p} onAbrir={() => setModalId(p.id)} />
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {modalId && <PedidoModal id={modalId} onClose={() => setModalId(null)} />}
    </div>
  );
}

function PedidoCard({ pedido: p, onAbrir }: { pedido: PedidoResumo; onAbrir: () => void }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <button type="button" onClick={onAbrir} className="mb-1 flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">{p.codigo}</span>
            <span className="font-medium text-neutral-100">{p.cliente?.nome}</span>
            {p.cliente?.codigo && <span className="text-[10px] text-neutral-500">{p.cliente.codigo}</span>}
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">{p.tipo}</span>
            {p.info_falta && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">Falta info</span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-neutral-300">{p.descricao}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Origem: {p.origem || "—"}
            {p.morada ? ` · ${p.morada}` : ""} · {new Date(p.created_at).toLocaleDateString("pt-PT")}
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${p.estadoOperacional.cls}`}>{p.estadoOperacional.label}</span>
      </button>

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
            <input type="hidden" name="client_id" value={p.cliente?.id ?? ""} />
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
}
