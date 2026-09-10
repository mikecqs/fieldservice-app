"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarModelo, apagarModelo } from "../actions";

export default function DetalhesModeloForm({
  templateId,
  nome,
  condicoes,
  validadeDias,
  ivaPercent,
}: {
  templateId: string;
  nome: string;
  condicoes: string;
  validadeDias: number;
  ivaPercent: number;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [aApagar, setAApagar] = useState(false);

  const inputClasses =
    "w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none";

  async function onSubmit(formData: FormData) {
    setErro(null);
    setGuardado(false);
    const resultado = await atualizarModelo(templateId, formData);
    if (resultado?.erro) {
      setErro(resultado.erro);
    } else {
      setGuardado(true);
    }
  }

  async function onApagar() {
    if (!confirm("Apagar este modelo? Esta ação não pode ser desfeita.")) return;
    setAApagar(true);
    const resultado = await apagarModelo(templateId);
    if (resultado?.erro) {
      setErro(resultado.erro);
      setAApagar(false);
    } else {
      router.push("/empresa");
    }
  }

  return (
    <section className="rounded-2xl border border-edge bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Detalhes do modelo</h2>
      <form action={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-muted-foreground">Nome</label>
          <input name="nome" defaultValue={nome} required className={`mt-1 ${inputClasses}`} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Condições</label>
          <textarea
            name="condicoes"
            defaultValue={condicoes}
            rows={4}
            placeholder="Condições de pagamento, prazo de execução, garantia..."
            className={`mt-1 ${inputClasses}`}
          />
        </div>
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-muted-foreground">Validade (dias)</label>
            <input name="validadeDias" type="number" defaultValue={validadeDias} className={`mt-1 w-28 ${inputClasses}`} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">IVA (%)</label>
            <input name="ivaPercent" type="number" step="0.1" defaultValue={ivaPercent} className={`mt-1 w-28 ${inputClasses}`} />
          </div>
        </div>
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        {guardado && !erro && <p className="text-sm text-emerald-400">Guardado.</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onApagar}
            disabled={aApagar}
            className="rounded-md border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            {aApagar ? "A apagar..." : "Apagar modelo"}
          </button>
        </div>
      </form>
    </section>
  );
}
