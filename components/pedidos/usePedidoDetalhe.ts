"use client";

import { useEffect, useState } from "react";
import { obterDetalhePedido } from "@/app/admin/pedidos/actions";
import type { PedidoDetalhe } from "@/components/pedidos/PedidoDetalheConteudo";

// Carregamento do detalhe de um Pedido (obterDetalhePedido — única fonte da
// query), partilhado entre o PedidoModal e o painel lateral do Centro de
// Operações, para nunca haver duas versões desta lógica.
export function usePedidoDetalhe(id: string | null) {
  const [detalhe, setDetalhe] = useState<PedidoDetalhe | null>(null);
  const [aCarregar, setACarregar] = useState(!!id);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    setACarregar(true);
    setErro(null);
    setDetalhe(null);
    obterDetalhePedido(id)
      .then((res) => {
        if (cancelado) return;
        if (!res) setErro("Pedido não encontrado.");
        else setDetalhe(res as PedidoDetalhe);
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

  return { detalhe, aCarregar, erro };
}
