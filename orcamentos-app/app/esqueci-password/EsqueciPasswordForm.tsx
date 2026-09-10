"use client";

import { useState } from "react";
import Link from "next/link";
import { pedirRecuperacaoPassword } from "./actions";

export default function EsqueciPasswordForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setAEnviar(true);
    const resultado = await pedirRecuperacaoPassword(formData);
    setAEnviar(false);
    if (resultado?.erro) setErro(resultado.erro);
    if (resultado?.enviado) setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="text-sm text-neutral-200">
        Se existir uma conta com esse email, vai receber uma mensagem com um link para repor a
        password. Verifique também a pasta de spam.{" "}
        <Link href="/login" className="text-white hover:underline">
          Voltar ao login
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-200">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
        />
      </div>
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <button
        type="submit"
        disabled={aEnviar}
        className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.01] hover:bg-neutral-200 disabled:opacity-60"
      >
        {aEnviar ? "A enviar..." : "Enviar link de recuperação"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-white hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
