"use client";

import { useRef, useState } from "react";
import { adicionarMaterialPlaneado } from "../actions";

// Mesmo bug do formulário de Utilizadores: sem redirect, o form nunca
// desmontava e os campos ficavam com o último material escrito depois de
// gravar. form.reset() aqui só corre depois de confirmar sucesso.
export function MaterialPlaneadoForm({ serviceId }: { serviceId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function submeter(formData: FormData) {
    setErro(null);
    try {
      await adicionarMaterialPlaneado(formData);
      formRef.current?.reset();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível adicionar o material.");
    }
  }

  return (
    <form ref={formRef} action={submeter} className="space-y-2">
      {erro && <p className="rounded-md bg-red-500/15 px-2 py-1.5 text-xs text-red-400">{erro}</p>}
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <input type="hidden" name="service_id" value={serviceId} />
        <input name="nome" placeholder="Material" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm sm:flex-1" />
        <input name="qtd" type="number" step="0.01" defaultValue="1" placeholder="Qtd" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm sm:w-20" />
        <input name="preco_venda" type="number" step="0.01" defaultValue="0" placeholder="€ venda" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm sm:w-24" />
        <button className="col-span-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-neutral-950 hover:bg-neutral-200 sm:col-span-1">
          Adicionar
        </button>
      </div>
    </form>
  );
}
