"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarCliente } from "../actions";

// Depois de criado, nunca navega logo — pergunta primeiro "Deseja criar um
// pedido?" (Sim leva ao formulário de Novo Pedido já com este cliente
// selecionado; Não vai para a ficha do cliente). Elimina o fluxo anterior
// de criar cliente → voltar à lista → procurar cliente → abrir pedidos.
export function NovoClienteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ id: string; nome: string } | null>(null);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    try {
      const cliente = await criarCliente(new FormData(formRef.current!));
      setCriado({ id: (cliente as any).id, nome: (cliente as any).nome });
    } catch (err: any) {
      setErro(err?.message || "Não foi possível criar o cliente.");
    } finally {
      setAGuardar(false);
    }
  }

  if (criado) {
    return (
      <div className="space-y-5 py-2 text-center">
        <p className="text-sm text-neutral-300">
          Cliente <span className="font-semibold text-white">{criado.nome}</span> criado com sucesso.
        </p>
        <p className="text-sm font-medium text-neutral-100">Deseja criar um pedido?</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/pedidos/novo?clientId=${criado.id}`)}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Sim, criar pedido
          </button>
          <button
            type="button"
            onClick={() => router.push(`/admin/clientes/${criado.id}`)}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            Não, terminar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submeter} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {erro && <p className="col-span-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-400">{erro}</p>}
      <label className="col-span-2 block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Nome</span>
        <input name="nome" required className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Empresa (opcional)</span>
        <input name="empresa" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">NIF</span>
        <input name="nif" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Telefone</span>
        <input name="telefone" required className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Email</span>
        <input name="email" type="email" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <label className="col-span-2 block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Morada</span>
        <input name="endereco" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <div className="col-span-2 mt-2 flex justify-end gap-2">
        <Link href="/admin/clientes" className="rounded-md border border-neutral-700 px-3.5 py-2 text-sm text-neutral-200">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={aGuardar}
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
        >
          {aGuardar ? "A guardar…" : "Guardar cliente"}
        </button>
      </div>
    </form>
  );
}
