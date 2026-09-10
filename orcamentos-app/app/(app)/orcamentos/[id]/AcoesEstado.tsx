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
    <section className="rounded-2xl border border-edge bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Ações</h2>
      <div className="flex flex-wrap items-end gap-3">
        {podeMarcarEnviado({ estado }) && (
          <div>
            <button
              type="button"
              onClick={() => executar(() => marcarEnviado(budgetId))}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200"
            >
              Marcar enviado
            </button>
            <p className="mt-1 text-xs text-muted-foreground">Agenda o follow-up automaticamente.</p>
          </div>
        )}

        {podeMarcarFollowup({ estado }) && (
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-muted-foreground">
                {estado === "followup" ? "Ajustar data do follow-up" : "Data do follow-up"}
              </label>
              <input
                type="date"
                value={dataFollowup}
                onChange={(e) => setDataFollowup(e.target.value)}
                className="mt-1 rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white focus:border-edge-subtle focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const formData = new FormData();
                formData.set("followupEm", dataFollowup);
                executar(() => marcarFollowup(budgetId, formData));
              }}
              className="rounded-md border border-edge-subtle px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
            >
              Marcar follow-up
            </button>
          </div>
        )}

        {podeAceitarOrcamento({ estado }) && (
          <button
            type="button"
            onClick={() => executar(() => aceitarOrcamento(budgetId))}
            className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            Marcar aceite
          </button>
        )}

        {podeRecusarOrcamento({ estado }) && (
          <button
            type="button"
            onClick={() => executar(() => recusarOrcamento(budgetId))}
            className="rounded-md border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            Marcar recusado
          </button>
        )}

        {podeCancelarOrcamento({ estado }) && (
          <button
            type="button"
            onClick={() => executar(() => cancelarOrcamento(budgetId))}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-raised hover:text-muted"
          >
            Cancelar orçamento
          </button>
        )}
      </div>
      {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
    </section>
  );
}
