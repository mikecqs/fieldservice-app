"use client";

import { useState } from "react";
import { PedidoModal } from "./PedidoModal";

// Abre o PedidoModal (só leitura, via RLS — funciona para ADMIN e FINANCE)
// em vez de um <Link> para /admin/pedidos/[id], que quebraria para FINANCE.
export function PedidoCodigoBadge({ id, codigo, className }: { id: string; codigo: string; className?: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={className}>
        {codigo}
      </button>
      {aberto && <PedidoModal id={id} onClose={() => setAberto(false)} />}
    </>
  );
}
