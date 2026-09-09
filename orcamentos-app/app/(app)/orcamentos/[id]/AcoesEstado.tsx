"use client";

import { useState } from "react";
import {
  podeAceitarOrcamento,
  podeCancelarOrcamento,
  podeMarcarEnviado,
  podeMarcarFollowup,
  podeRecusarOrcamento,
} from "@/lib/orcamento-estado";
import { aceitarOrcamento, cancelarOrcamento, marcarEnviado, marcarFollowup, recusarOrcamento } from "../actions";

export default function AcoesEstado({
  budgetId,
  estado,
  followupEm,
}: {
  budgetId: string;
  estado: string;
  followupEm: string | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [dataFollowup, setDataFollowup] = useState(followupEm ?? "");

  async function executar(acao: () => Promise<{ erro?: string }>) {
    setErro(null);
    const resultado = await acao();
    if (resultado?.erro) setErro(resultado.erro);
  }

  if (estado === "aceite" || estado === "recusado" || estado === "cancelado") {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Ações</h2>
      <div className="flex flex-wrap items-end gap-3">
        {podeMarcarEnviado({ estado }) && (
          <button
            type="button"
            onClick={() => executar(() => marcarEnviado(budgetId))}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Marcar enviado
          </button>
        )}

        {podeMarcarFollowup({ estado }) && (
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500">Data do follow-up</label>
              <input
                type="date"
                value={dataFollowup}
                onChange={(e) => setDataFollowup(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const formData = new FormData();
                formData.set("followupEm", dataFollowup);
                executar(() => marcarFollowup(budgetId, formData));
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Marcar follow-up
            </button>
          </div>
        )}

        {podeAceitarOrcamento({ estado }) && (
          <button
            type="button"
            onClick={() => executar(() => aceitarOrcamento(budgetId))}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Marcar aceite
          </button>
        )}

        {podeRecusarOrcamento({ estado }) && (
          <button
            type="button"
            onClick={() => executar(() => recusarOrcamento(budgetId))}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Marcar recusado
          </button>
        )}

        {podeCancelarOrcamento({ estado }) && (
          <button
            type="button"
            onClick={() => executar(() => cancelarOrcamento(budgetId))}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            Cancelar orçamento
          </button>
        )}
      </div>
      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
    </section>
  );
}
