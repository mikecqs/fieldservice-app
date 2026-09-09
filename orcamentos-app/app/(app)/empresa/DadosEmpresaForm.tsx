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

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-slate-500">Nome da empresa *</label>
          <input
            name="nome"
            defaultValue={empresa.nome}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">NIF</label>
          <input
            name="nif"
            defaultValue={empresa.nif ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Telefone</label>
          <input
            name="telefone"
            defaultValue={empresa.telefone ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={empresa.email ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500">Endereço</label>
          <input
            name="endereco"
            defaultValue={empresa.endereco ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500">Condições padrão</label>
        <textarea
          name="condicoesPadrao"
          defaultValue={empresa.condicoes_padrao ?? ""}
          rows={4}
          placeholder="Ex: Pagamento a 30 dias. Garantia de 12 meses. Orçamento válido 30 dias."
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-slate-400">Usadas como texto inicial em cada novo orçamento (editável por orçamento).</p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {guardado && !erro && <p className="text-sm text-emerald-600">Guardado.</p>}

      <button
        type="submit"
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Guardar
      </button>
    </form>
  );
}
