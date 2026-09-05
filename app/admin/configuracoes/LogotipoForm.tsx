"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { guardarLogotipo, removerLogotipo } from "./actions";

export function LogotipoForm({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aRemover, setARemover] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submeter(formData: FormData) {
    setErro(null);
    setAGuardar(true);
    try {
      await guardarLogotipo(formData);
      formRef.current?.reset();
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível guardar o logotipo.");
    } finally {
      setAGuardar(false);
    }
  }

  async function remover() {
    setErro(null);
    setARemover(true);
    try {
      await removerLogotipo();
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível remover o logotipo.");
    } finally {
      setARemover(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="mb-1 text-sm font-semibold text-neutral-100">Logotipo da empresa</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Usado nos PDFs de orçamentos e fechos de serviço, em vez do símbolo genérico. PNG ou JPEG, até 2MB.
      </p>

      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logotipo atual"
          className="mb-3 h-16 rounded-md border border-neutral-800 bg-white p-1 object-contain"
        />
      )}

      <form ref={formRef} action={submeter} className="flex flex-wrap items-center gap-2">
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          required
          className="text-xs text-neutral-300 file:mr-2 file:rounded-md file:border file:border-neutral-700 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:text-neutral-200"
        />
        <button
          type="submit"
          disabled={aGuardar}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {aGuardar ? "A guardar…" : "Guardar logotipo"}
        </button>
        {logoUrl && (
          <button
            type="button"
            onClick={remover}
            disabled={aRemover}
            className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aRemover ? "A remover…" : "Remover"}
          </button>
        )}
      </form>
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </div>
  );
}
