"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ESTADO_LABEL, ESTADO_COLOR } from "@/lib/orcamento-visual";

export type OrcamentoResumo = {
  id: string;
  numero: number | string;
  estado: string;
  criado_em: string;
  clients: { nome: string } | null;
  iva_percent: number;
  total: number;
};

type Grupo = "ativo" | "aceite" | "concluido";

// Auditoria "Orçamentos recusados" (Ponto 10) — reorganização só de exibição,
// nenhum estado novo na BD: reutiliza exatamente os estados que já existiam
// (rascunho/enviado/aguarda_resposta/followup/aceite/recusado/cancelado).
// Mesmo padrão já usado em PedidosLista.tsx (grupoDe + GRUPO_INFO).
function grupoDe(o: OrcamentoResumo): Grupo {
  if (o.estado === "aceite") return "aceite";
  if (o.estado === "recusado" || o.estado === "cancelado") return "concluido";
  return "ativo";
}

const GRUPO_INFO: Record<Grupo, { titulo: string }> = {
  ativo: { titulo: "Ativos" },
  aceite: { titulo: "Aceites · seguiram para Serviço" },
  concluido: { titulo: "Concluídos" },
};

export function OrcamentosLista({ orcamentos }: { orcamentos: OrcamentoResumo[] }) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return orcamentos;
    return orcamentos.filter((o) => {
      const alvo = [String(o.numero), o.clients?.nome, ESTADO_LABEL[o.estado] ?? o.estado]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [orcamentos, busca]);

  const grupos = useMemo(() => {
    const mapa: Record<Grupo, OrcamentoResumo[]> = { ativo: [], aceite: [], concluido: [] };
    for (const o of filtrados) mapa[grupoDe(o)].push(o);
    return mapa;
  }, [filtrados]);

  return (
    <div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Pesquisar por número, cliente ou estado…"
        className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
      />

      {orcamentos.length === 0 && <p className="py-10 text-center text-sm text-neutral-500">Ainda sem orçamentos.</p>}
      {orcamentos.length > 0 && filtrados.length === 0 && (
        <p className="py-10 text-center text-sm text-neutral-500">Nenhum orçamento corresponde à pesquisa.</p>
      )}

      <div className="space-y-6">
        {(["ativo", "aceite", "concluido"] as Grupo[]).map((g) =>
          grupos[g].length === 0 ? null : (
            <div key={g}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                {GRUPO_INFO[g].titulo} · {grupos[g].length}
              </h2>
              <div className="space-y-2">
                {grupos[g].map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/orcamentos/${o.id}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 hover:shadow-sm"
                  >
                    <div>
                      <div className="font-medium text-neutral-100">#{o.numero} · {o.clients?.nome}</div>
                      <div className="text-xs text-neutral-500">Criado {o.criado_em}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-neutral-200">
                          {o.total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                        </div>
                        <div className="text-[10px] text-neutral-500">c/ IVA ({o.iva_percent}%)</div>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[o.estado] ?? ""}`}>
                        {ESTADO_LABEL[o.estado] ?? o.estado}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
