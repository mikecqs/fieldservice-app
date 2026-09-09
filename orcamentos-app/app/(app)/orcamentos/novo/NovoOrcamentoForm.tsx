"use client";

import { useState } from "react";
import { criarOrcamento } from "../actions";

type Cliente = { id: string; nome: string; empresa: string | null; telefone: string | null };

export default function NovoOrcamentoForm({ clientes }: { clientes: Cliente[] }) {
  const [modo, setModo] = useState<"existente" | "novo">(clientes.length ? "existente" : "novo");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  async function onSubmit(formData: FormData) {
    setErro(null);
    setAEnviar(true);
    formData.set("clientId", modo === "novo" ? "novo" : String(formData.get("clientSelecionado") ?? ""));
    const resultado = await criarOrcamento(formData);
    setAEnviar(false);
    if (resultado?.erro) setErro(resultado.erro);
  }

  return (
    <form action={onSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setModo("existente")}
            disabled={!clientes.length}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              modo === "existente" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            } disabled:opacity-40`}
          >
            Cliente existente
          </button>
          <button
            type="button"
            onClick={() => setModo("novo")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              modo === "novo" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Novo cliente
          </button>
        </div>

        {modo === "existente" ? (
          <select
            name="clientSelecionado"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Selecione um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
                {cliente.empresa ? ` — ${cliente.empresa}` : ""}
                {cliente.telefone ? ` (${cliente.telefone})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="novoClienteNome"
              placeholder="Nome *"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              name="novoClienteEmpresa"
              placeholder="Empresa do cliente"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              name="novoClienteTelefone"
              placeholder="Telefone"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              name="novoClienteEmail"
              placeholder="Email"
              type="email"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              name="novoClienteNif"
              placeholder="NIF"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              name="novoClienteMorada"
              placeholder="Morada"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:col-span-2"
            />
          </div>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={aEnviar}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {aEnviar ? "A criar..." : "Criar orçamento"}
      </button>
      <p className="text-xs text-slate-500">
        Os itens e as condições são adicionados no ecrã seguinte.
      </p>
    </form>
  );
}
