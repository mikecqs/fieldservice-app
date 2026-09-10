"use client";

import { useState } from "react";
import { guardarDadosEmpresa } from "./actions";
import type { Company } from "@/lib/auth";

export default function DadosEmpresaForm({ empresa }: { empresa: Company }) {
  const [erro, setErro] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setGuardado(false);
    const resultado = await guardarDadosEmpresa(formData);
    if (resultado?.erro) setErro(resultado.erro);
    else setGuardado(true);
  }

  const inputClasses =
    "mt-1 w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none";

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-muted-foreground">Nome da empresa *</label>
          <input name="nome" defaultValue={empresa.nome} required className={inputClasses} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">NIF</label>
          <input name="nif" defaultValue={empresa.nif ?? ""} className={inputClasses} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Telefone</label>
          <input name="telefone" defaultValue={empresa.telefone ?? ""} className={inputClasses} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Email</label>
          <input name="email" type="email" defaultValue={empresa.email ?? ""} className={inputClasses} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground">Endereço</label>
          <input name="endereco" defaultValue={empresa.endereco ?? ""} className={inputClasses} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">Condições padrão</label>
        <textarea
          name="condicoesPadrao"
          defaultValue={empresa.condicoes_padrao ?? ""}
          rows={4}
          placeholder="Ex: Pagamento a 30 dias. Garantia de 12 meses. Orçamento válido 30 dias."
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-muted-foreground">Usadas como texto inicial em cada novo orçamento (editável por orçamento).</p>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">Dias para follow-up automático</label>
        <input
          name="followupDiasPadrao"
          type="number"
          min={1}
          step={1}
          defaultValue={empresa.followup_dias_padrao}
          className={`w-32 ${inputClasses}`}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Ao marcar um orçamento como enviado, o follow-up é agendado automaticamente esta quantidade de dias depois.
        </p>
      </div>

      {erro && <p className="text-sm text-red-400">{erro}</p>}
      {guardado && !erro && <p className="text-sm text-emerald-400">Guardado.</p>}

      <button
        type="submit"
        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200"
      >
        Guardar
      </button>
    </form>
  );
}
