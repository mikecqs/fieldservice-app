"use client";

import { useRef, useState } from "react";
import { guardarLogotipo, removerLogotipo } from "./actions";

export default function LogoForm({ logoUrl }: { logoUrl: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aRemover, setARemover] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setAGuardar(true);
    const resultado = await guardarLogotipo(formData);
    setAGuardar(false);
    if (resultado?.erro) setErro(resultado.erro);
    else formRef.current?.reset();
  }

  async function onRemover() {
    setErro(null);
    setARemover(true);
    const resultado = await removerLogotipo();
    setARemover(false);
    if (resultado?.erro) setErro(resultado.erro);
  }

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-neutral-200">Logotipo</h2>
      <p className="mb-3 text-xs text-muted-foreground">Usado no PDF dos orçamentos. PNG ou JPEG.</p>

      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logotipo atual" className="mb-3 h-16 rounded-md border border-edge bg-white p-1 object-contain" />
      )}

      <form ref={formRef} action={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          required
          className="text-xs text-muted file:mr-2 file:rounded-md file:border file:border-edge file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:text-neutral-200"
        />
        <button
          type="submit"
          disabled={aGuardar}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
        >
          {aGuardar ? "A guardar..." : "Guardar logotipo"}
        </button>
        {logoUrl && (
          <button
            type="button"
            onClick={onRemover}
            disabled={aRemover}
            className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {aRemover ? "A remover..." : "Remover"}
          </button>
        )}
      </form>
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </div>
  );
}
