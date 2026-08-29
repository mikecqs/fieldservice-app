"use client";

import { useRef, useState } from "react";
import { criarUtilizador } from "./actions";

// O <form action={serverAction}> sozinho não limpa os campos depois de um
// sucesso: a Server Action não faz redirect, então o DOM do formulário
// nunca é desmontado/remontado — os inputs (não controlados) mantêm o que
// lá estava escrito. Este wrapper chama a action manualmente e só faz
// form.reset() depois de confirmar sucesso (nunca em caso de erro, para o
// Admin poder corrigir sem reescrever tudo).
export function NovoUtilizadorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  async function submeter(formData: FormData) {
    setErro(null);
    setAGuardar(true);
    try {
      await criarUtilizador(formData);
      formRef.current?.reset();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar o utilizador.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <form ref={formRef} action={submeter} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {erro && <p className="col-span-2 rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-400">{erro}</p>}
      <input name="nome" placeholder="Nome" required className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      <select name="role" defaultValue="TECHNICIAN" className="rounded-md border border-neutral-700 px-3 py-2 text-sm">
        <option value="TECHNICIAN">Técnico</option>
        <option value="ADMIN">Admin</option>
        <option value="FINANCE">Financeiro</option>
      </select>
      <input name="email" type="email" placeholder="Email" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      <input name="password" type="password" placeholder="Palavra-passe inicial" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      <button
        type="submit"
        disabled={aGuardar}
        className="col-span-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
      >
        {aGuardar ? "A criar…" : "Criar utilizador"}
      </button>
    </form>
  );
}
