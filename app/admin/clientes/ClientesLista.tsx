"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type ClienteResumo = {
  id: string;
  codigo: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  totalMoradas: number;
};

// Não existia nenhuma pesquisa nesta lista — mesmo padrão leve já usado em
// Pedidos (useState + filtro client-side, sem dependências novas), agora
// também a encontrar pelo código humano do cliente.
export function ClientesLista({ clientes }: { clientes: ClienteResumo[] }) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) =>
      [c.codigo, c.nome, c.empresa, c.telefone].filter(Boolean).join(" ").toLowerCase().includes(termo)
    );
  }, [clientes, busca]);

  return (
    <div>
      {clientes.length > 6 && (
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por código, nome, empresa ou telefone…"
          className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtrados.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clientes/${c.id}`}
            className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                  {c.codigo}
                </span>
                <span className="truncate font-medium text-neutral-100">{c.nome}</span>
              </div>
              <div className="truncate text-xs text-neutral-500">
                {c.totalMoradas} morada(s) · {c.telefone}
              </div>
            </div>
          </Link>
        ))}
        {clientes.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-neutral-500">Ainda sem clientes — cria o primeiro.</p>
        )}
        {clientes.length > 0 && filtrados.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-neutral-500">Nenhum cliente corresponde à pesquisa.</p>
        )}
      </div>
    </div>
  );
}
