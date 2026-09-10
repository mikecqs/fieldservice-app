"use client";

import { useState } from "react";
import { redefinirPassword } from "./actions";

export default function ResetPasswordForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setAEnviar(true);
    const resultado = await redefinirPassword(formData);
    setAEnviar(false);
    if (resultado?.erro) setErro(resultado.erro);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-200">Nova password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-200">Confirmar nova password</label>
        <input
          name="confirmacao"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
        />
      </div>
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <button
        type="submit"
        disabled={aEnviar}
        className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.01] hover:bg-neutral-200 disabled:opacity-60"
      >
        {aEnviar ? "A guardar..." : "Definir nova password"}
      </button>
    </form>
  );
}
