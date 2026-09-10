"use client";

import { useState } from "react";
import { criarModelo } from "../actions";

export default function NovoModeloForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setAEnviar(true);
    const resultado = await criarModelo(formData);
    setAEnviar(false);
    if (resultado?.erro) setErro(resultado.erro);
  }

  return (
    <form action={onSubmit} className="space-y-4 rounded-2xl border border-edge bg-surface p-6">
      <div>
        <label className="block text-sm font-medium text-neutral-200">Nome do modelo</label>
        <input
          name="nome"
          type="text"
          required
          placeholder="Ex: Instalação padrão, Manutenção anual..."
          className="mt-1 w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
        />
      </div>

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      <button
        type="submit"
        disabled={aEnviar}
        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200 disabled:opacity-60"
      >
        {aEnviar ? "A criar..." : "Criar modelo"}
      </button>
      <p className="text-xs text-muted-foreground">
        Condições, IVA, validade e itens são adicionados no ecrã seguinte.
      </p>
    </form>
  );
}
