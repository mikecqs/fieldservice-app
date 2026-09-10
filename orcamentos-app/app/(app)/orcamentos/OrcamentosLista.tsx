"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ESTADOS_ORCAMENTO, ROTULOS_ESTADO, type EstadoOrcamento } from "@/lib/orcamento-estado";
import EstadoBadge from "../EstadoBadge";

export type OrcamentoLinha = {
  id: string;
  numero: string;
  estado: string;
  criadoEm: string;
  followupEm: string | null;
  total: number;
  clienteNome: string;
  clienteEmpresa: string;
  clienteTelefone: string;
  clienteMorada: string;
  clienteNif: string;
};

type Ordenacao = "recentes" | "antigos" | "valor_desc" | "valor_asc";

function estaAtrasado(linha: OrcamentoLinha): boolean {
  if (!linha.followupEm) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    linha.followupEm < hoje &&
    !["aceite", "servico_realizado", "faturado", "recusado", "cancelado"].includes(linha.estado)
  );
}

export default function OrcamentosLista({
  linhas,
  estadoInicial,
}: {
  linhas: OrcamentoLinha[];
  estadoInicial?: string;
}) {
  const [termo, setTermo] = useState("");
  const estadoValido = (ESTADOS_ORCAMENTO as readonly string[]).includes(estadoInicial ?? "")
    ? (estadoInicial as EstadoOrcamento)
    : "todos";
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoOrcamento | "todos">(estadoValido);
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");

  const filtradas = useMemo(() => {
    const termoLower = termo.trim().toLowerCase();

    let resultado = linhas.filter((linha) => {
      if (estadoFiltro !== "todos" && linha.estado !== estadoFiltro) return false;
      if (soAtrasados && !estaAtrasado(linha)) return false;
      if (!termoLower) return true;

      const alvo = [
        linha.numero,
        linha.clienteNome,
        linha.clienteEmpresa,
        linha.clienteTelefone,
        linha.clienteMorada,
        linha.clienteNif,
      ]
        .join(" ")
        .toLowerCase();

      return alvo.includes(termoLower);
    });

    resultado = [...resultado].sort((a, b) => {
      switch (ordenacao) {
        case "recentes":
          return b.criadoEm.localeCompare(a.criadoEm);
        case "antigos":
          return a.criadoEm.localeCompare(b.criadoEm);
        case "valor_desc":
          return b.total - a.total;
        case "valor_asc":
          return a.total - b.total;
      }
    });

    return resultado;
  }, [linhas, termo, estadoFiltro, soAtrasados, ordenacao]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Pesquisar por cliente, empresa, telefone, morada, NIF..."
          className="min-w-[260px] flex-1 rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
        />
        <select
          value={ordenacao}
          onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
          className="rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white focus:border-edge-subtle focus:outline-none"
        >
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="valor_desc">Valor (maior primeiro)</option>
          <option value="valor_asc">Valor (menor primeiro)</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={soAtrasados}
            onChange={(e) => setSoAtrasados(e.target.checked)}
          />
          Só atrasados
        </label>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEstadoFiltro("todos")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            estadoFiltro === "todos" ? "bg-white text-neutral-950" : "bg-surface-raised text-muted hover:text-white"
          }`}
        >
          Todos ({linhas.length})
        </button>
        {ESTADOS_ORCAMENTO.map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => setEstadoFiltro(estado)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              estadoFiltro === estado ? "bg-white text-neutral-950" : "bg-surface-raised text-muted hover:text-white"
            }`}
          >
            {ROTULOS_ESTADO[estado]} ({linhas.filter((l) => l.estado === estado).length})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-edge bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-muted-foreground">
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Follow-up</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((linha) => (
              <tr key={linha.id} className="border-b border-edge/60 last:border-0 hover:bg-surface-raised">
                <td className="px-4 py-3">
                  <Link href={`/orcamentos/${linha.id}`} className="font-medium text-white hover:underline">
                    {linha.numero}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="text-neutral-200">{linha.clienteNome}</div>
                  {linha.clienteEmpresa && (
                    <div className="text-xs text-muted-foreground">{linha.clienteEmpresa}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <EstadoBadge estado={linha.estado} />
                </td>
                <td className="px-4 py-3">
                  {linha.followupEm ? (
                    <span className={estaAtrasado(linha) ? "font-medium text-red-400" : "text-muted"}>
                      {linha.followupEm}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-neutral-200">{linha.total.toFixed(2)} €</td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum orçamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
