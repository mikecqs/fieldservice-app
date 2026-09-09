"use client";

import { useState } from "react";
import Link from "next/link";
import { criarConta } from "./actions";

export default function SignupForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [verificarEmail, setVerificarEmail] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setAEnviar(true);
    const resultado = await criarConta(formData);
    setAEnviar(false);
    if (resultado?.erro) setErro(resultado.erro);
    if (resultado?.verificarEmail) setVerificarEmail(true);
  }

  if (verificarEmail) {
    return (
      <p className="text-sm text-slate-700">
        Conta criada. Verifique o seu email para confirmar a conta e depois
        entre em <Link href="/login" className="text-brand-600 hover:underline">/login</Link>.
      </p>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Nome da empresa</label>
        <input
          name="nomeEmpresa"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={aEnviar}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {aEnviar ? "A criar conta..." : "Criar conta"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Já tem conta?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
