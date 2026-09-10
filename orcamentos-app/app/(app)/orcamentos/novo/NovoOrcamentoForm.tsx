"use client";

import { useState } from "react";
import { criarOrcamento } from "../actions";

type Cliente = { id: string; nome: string; empresa: string | null; telefone: string | null };
type Modelo = { id: string; nome: string };

export default function NovoOrcamentoForm({ clientes, modelos }: { clientes: Cliente[]; modelos: Modelo[] }) {
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

  const inputClasses =
    "rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none";

  return (
    <form action={onSubmit} className="space-y-6 rounded-2xl border border-edge bg-surface p-6">
      <div>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setModo("existente")}
            disabled={!clientes.length}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              modo === "existente" ? "bg-white text-neutral-950" : "bg-surface-raised text-muted"
            } disabled:opacity-40`}
          >
            Cliente existente
          </button>
          <button
            type="button"
            onClick={() => setModo("novo")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              modo === "novo" ? "bg-white text-neutral-950" : "bg-surface-raised text-muted"
            }`}
          >
            Novo cliente
          </button>
        </div>

        {modo === "existente" ? (
          <select name="clientSelecionado" required className={`w-full ${inputClasses}`}>
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
            <input name="novoClienteNome" placeholder="Nome *" required className={inputClasses} />
            <input name="novoClienteEmpresa" placeholder="Empresa do cliente" className={inputClasses} />
            <input name="novoClienteTelefone" placeholder="Telefone" className={inputClasses} />
            <input name="novoClienteEmail" placeholder="Email" type="email" className={inputClasses} />
            <input name="novoClienteNif" placeholder="NIF" className={inputClasses} />
            <input
              name="novoClienteMorada"
              placeholder="Morada"
              className={`sm:col-span-2 ${inputClasses}`}
            />
          </div>
        )}
      </div>

      {modelos.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-neutral-200">Modelo (opcional)</label>
          <select name="templateId" defaultValue="" className={`mt-1 w-full ${inputClasses}`}>
            <option value="">Nenhum — começar em branco</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Usa os itens e as condições desse modelo como ponto de partida.
          </p>
        </div>
      )}

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      <button
        type="submit"
        disabled={aEnviar}
        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200 disabled:opacity-60"
      >
        {aEnviar ? "A criar..." : "Criar orçamento"}
      </button>
      <p className="text-xs text-muted-foreground">
        Sem modelo escolhido, os itens e as condições são adicionados no ecrã seguinte.
      </p>
    </form>
  );
}
