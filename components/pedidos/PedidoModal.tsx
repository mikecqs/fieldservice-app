"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obterDetalhePedido } from "@/app/admin/pedidos/actions";
import { PedidoDetalheConteudo, type PedidoDetalhe } from "@/components/pedidos/PedidoDetalheConteudo";

// Popup de consulta rápida — mesmo padrão visual/estrutural do
// ServicoModal.tsx da Agenda (overlay + painel, fecha ao clicar fora ou no
// botão). Só leitura: busca o percurso completo do pedido (obterDetalhePedido,
// a mesma função usada pela página /admin/pedidos/[id]) sem obrigar a sair
// da lista. Quem precisar de agir (converter/arquivar/marcar info) segue
// para a página completa a partir daqui — o popup nunca duplica essas ações.
// Vive em components/pedidos/ (não em app/admin/pedidos/) precisamente para
// poder ser reutilizado a partir de outros módulos (ex: Clientes), sem
// duplicar um segundo sistema de detalhe de pedidos.
export function PedidoModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detalhe, setDetalhe] = useState<PedidoDetalhe | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setACarregar(true);
    setErro(null);
    setDetalhe(null);
    obterDetalhePedido(id)
      .then((res) => {
        if (cancelado) return;
        if (!res) {
          setErro("Pedido não encontrado.");
        } else {
          setDetalhe(res as PedidoDetalhe);
        }
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar o pedido.");
      })
      .finally(() => {
        if (!cancelado) setACarregar(false);
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-base font-bold text-white">Pedido</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800">
            Fechar ✕
          </button>
        </div>

        {aCarregar && <p className="py-8 text-center text-sm text-neutral-500">A carregar…</p>}
        {erro && <p className="py-8 text-center text-sm text-red-400">{erro}</p>}

        {detalhe && (
          <>
            <PedidoDetalheConteudo detalhe={detalhe} />
            <div className="mt-4 border-t border-neutral-800 pt-3">
              <Link href={`/admin/pedidos/${id}`} className="text-xs font-medium text-neutral-300 underline hover:text-white">
                Abrir página completa (agir sobre o pedido) →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
