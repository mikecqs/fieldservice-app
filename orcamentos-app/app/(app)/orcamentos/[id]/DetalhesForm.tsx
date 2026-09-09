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

  const inputClasses =
    "w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none disabled:bg-surface disabled:text-muted-foreground";

  return (
    <section className="rounded-2xl border border-edge bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Condições</h2>
      <form action={onSubmit} className="space-y-3">
        <textarea
          name="condicoes"
          defaultValue={condicoes}
          rows={4}
          placeholder="Condições de pagamento, prazo de execução, garantia..."
          className={inputClasses}
        />
        <textarea
          name="notas"
          defaultValue={notas}
          rows={2}
          placeholder="Notas internas (não aparecem no PDF)"
          className={inputClasses}
        />
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-muted-foreground">Validade (dias)</label>
            <input name="validadeDias" type="number" defaultValue={validadeDias} className={`mt-1 w-28 ${inputClasses}`} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">IVA (%)</label>
            <input
              name="ivaPercent"
              type="number"
              step="0.1"
              defaultValue={ivaPercent}
              disabled={!ivaEditavel}
              className={`mt-1 w-28 ${inputClasses}`}
            />
          </div>
        </div>
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        {guardado && !erro && <p className="text-sm text-emerald-400">Guardado.</p>}
        <button
          type="submit"
          className="rounded-md border border-edge-subtle px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
        >
          Guardar
        </button>
      </form>
    </section>
  );
}
