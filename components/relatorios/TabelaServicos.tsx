"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ESTADO_LABEL, ESTADO_COLOR } from "@/app/admin/servicos/estados";

export type ServicoLinha = {
  id: string;
  cliente: string;
  tipo: string;
  estado: string;
  data_agendada: string | null;
  valor: number;
  faturacao_estado: string;
};

type Coluna = "cliente" | "tipo" | "estado" | "data_agendada" | "valor";

const POR_PAGINA = 20;

export function TabelaServicos({ linhas }: { linhas: ServicoLinha[] }) {
  const [busca, setBusca] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<Coluna>("data_agendada");
  const [ordemDesc, setOrdemDesc] = useState(true);
  const [pagina, setPagina] = useState(0);

  const estadosDisponiveis = useMemo(() => Array.from(new Set(linhas.map((l) => l.estado))).sort(), [linhas]);

  const filtradas = useMemo(() => {
    let r = linhas;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      r = r.filter((l) => l.cliente.toLowerCase().includes(q) || l.tipo.toLowerCase().includes(q));
    }
    if (filtroEstado) r = r.filter((l) => l.estado === filtroEstado);
    const sorted = [...r].sort((a, b) => {
      const av = a[ordenarPor] ?? "";
      const bv = b[ordenarPor] ?? "";
      if (av < bv) return ordemDesc ? 1 : -1;
      if (av > bv) return ordemDesc ? -1 : 1;
      return 0;
    });
    return sorted;
  }, [linhas, busca, filtroEstado, ordenarPor, ordemDesc]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtradas.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA);

  const alternarOrdem = (col: Coluna) => {
    if (ordenarPor === col) setOrdemDesc(!ordemDesc);
    else {
      setOrdenarPor(col);
      setOrdemDesc(true);
    }
    setPagina(0);
  };

  const Cabecalho = ({ col, label }: { col: Coluna; label: string }) => (
    <th
      onClick={() => alternarOrdem(col)}
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium text-neutral-400 hover:text-neutral-200"
    >
      {label} {ordenarPor === col ? (ordemDesc ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
          placeholder="Pesquisar cliente ou tipo…"
          className="min-w-0 flex-1 rounded-md border border-neutral-700 px-3 py-1.5 text-sm sm:flex-none sm:w-56"
        />
        <select
          value={filtroEstado}
          onChange={(e) => {
            setFiltroEstado(e.target.value);
            setPagina(0);
          }}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
        >
          <option value="">Todos os estados</option>
          {estadosDisponiveis.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABEL[e] ?? e}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900">
            <tr>
              <Cabecalho col="cliente" label="Cliente" />
              <Cabecalho col="tipo" label="Tipo" />
              <Cabecalho col="estado" label="Estado" />
              <Cabecalho col="data_agendada" label="Data" />
              <Cabecalho col="valor" label="Valor" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {visiveis.map((l) => (
              <tr key={l.id} className="hover:bg-neutral-900/60">
                <td className="whitespace-nowrap px-3 py-2">
                  <Link href={`/admin/servicos/${l.id}`} className="text-neutral-200 underline decoration-neutral-700 hover:decoration-neutral-400">
                    {l.cliente}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{l.tipo}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTADO_COLOR[l.estado] ?? "bg-neutral-800 text-neutral-300"}`}>
                    {ESTADO_LABEL[l.estado] ?? l.estado}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-400">{l.data_agendada ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-200">
                  {Number(l.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-neutral-500">
                  Sem resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {filtradas.length} {filtradas.length === 1 ? "serviço" : "serviços"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={paginaAtual === 0}
            className="rounded border border-neutral-700 px-2 py-1 disabled:opacity-30"
          >
            ← Anterior
          </button>
          <span>
            {paginaAtual + 1} / {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={paginaAtual >= totalPaginas - 1}
            className="rounded border border-neutral-700 px-2 py-1 disabled:opacity-30"
          >
            Seguinte →
          </button>
        </div>
      </div>
    </div>
  );
}
