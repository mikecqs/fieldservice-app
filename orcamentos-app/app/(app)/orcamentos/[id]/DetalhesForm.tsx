"use client";

import { useState } from "react";
import { podeEditarItensOrcamento } from "@/lib/orcamento-estado";
import { atualizarDetalhesOrcamento } from "../actions";

export default function DetalhesForm({
  budgetId,
  estado,
  condicoes,
  notas,
  validadeDias,
  ivaPercent,
}: {
  budgetId: string;
  estado: string;
  condicoes: string;
  notas: string;
  validadeDias: number;
  ivaPercent: number;
}) {
  const ivaEditavel = podeEditarItensOrcamento({ estado });
  const [erro, setErro] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setGuardado(false);
    const resultado = await atualizarDetalhesOrcamento(budgetId, formData);
    if (resultado?.erro) {
      setErro(resultado.erro);
    } else {
      setGuardado(true);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Condições</h2>
      <form action={onSubmit} className="space-y-3">
        <textarea
          name="condicoes"
          defaultValue={condicoes}
          rows={4}
          placeholder="Condições de pagamento, prazo de execução, garantia..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <textarea
          name="notas"
          defaultValue={notas}
          rows={2}
          placeholder="Notas internas (não aparecem no PDF)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-slate-500">Validade (dias)</label>
            <input
              name="validadeDias"
              type="number"
              defaultValue={validadeDias}
              className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">IVA (%)</label>
            <input
              name="ivaPercent"
              type="number"
              step="0.1"
              defaultValue={ivaPercent}
              disabled={!ivaEditavel}
              className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {guardado && !erro && <p className="text-sm text-emerald-600">Guardado.</p>}
        <button
          type="submit"
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Guardar
        </button>
      </form>
    </section>
  );
}
