"use client";

import { useState } from "react";
import Link from "next/link";
import { criarServico } from "../actions";
import { criarMoradaRapida } from "@/app/admin/clientes/actions";

type Morada = { id: string; label: string; endereco: string };
type Cliente = { id: string; nome: string; client_addresses: Morada[] };

const TIPOS = ["Agendamento", "Orçamento", "Manutenção", "Instalação"];

// Mesmo padrão de cliente→morada já usado em NovoPedidoForm — as moradas
// mostradas vêm sempre só do client_addresses aninhado do cliente
// selecionado, nunca uma lista solta com moradas de outros clientes
// misturadas (bug real que existia aqui antes: um <select> só com todas as
// moradas de todos os clientes ao mesmo tempo).
export function NovoServicoForm({ clientesIniciais }: { clientesIniciais: Cliente[] }) {
  const [clientes, setClientes] = useState(clientesIniciais);
  const [clientId, setClientId] = useState("");
  const [addressId, setAddressId] = useState("");

  const [novaMoradaAberta, setNovaMoradaAberta] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState("");
  const [aGuardarMorada, setAGuardarMorada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const clienteSelecionado = clientes.find((c) => c.id === clientId);
  const moradas = clienteSelecionado?.client_addresses ?? [];

  function selecionarCliente(id: string) {
    setClientId(id);
    setAddressId("");
    setNovaMoradaAberta(false);
  }

  async function criarMorada() {
    setErro(null);
    if (!novoEndereco.trim() || !clientId) {
      setErro("Morada é obrigatória.");
      return;
    }
    setAGuardarMorada(true);
    try {
      const nova = await criarMoradaRapida({ client_id: clientId, endereco: novoEndereco });
      setClientes((prev) => prev.map((c) => (c.id === clientId ? { ...c, client_addresses: [...c.client_addresses, nova] } : c)));
      setAddressId(nova.id);
      setNovaMoradaAberta(false);
      setNovoEndereco("");
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar a morada.");
    } finally {
      setAGuardarMorada(false);
    }
  }

  const podeGuardar = Boolean(clientId && addressId);

  return (
    <form action={criarServico} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="address_id" value={addressId} />
      {erro && <p className="col-span-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-400">{erro}</p>}

      <label className="col-span-2 block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Cliente</span>
        <select
          name="client_id"
          required
          value={clientId}
          onChange={(e) => selecionarCliente(e.target.value)}
          className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
        >
          <option value="">— Selecionar cliente —</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      {clientId && (
        <div className="col-span-2">
          <span className="mb-1 block text-xs font-medium text-neutral-300">Morada</span>
          {!novaMoradaAberta ? (
            <div className="space-y-2">
              {moradas.length > 0 && (
                <select
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                >
                  <option value="">— Selecionar morada —</option>
                  {moradas.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}: {m.endereco}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setNovaMoradaAberta(true)}
                className="text-xs font-medium text-neutral-300 underline hover:text-white"
              >
                + {moradas.length > 0 ? "Adicionar outra morada" : "Adicionar morada"}
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-800 p-3">
              <input
                value={novoEndereco}
                onChange={(e) => setNovoEndereco(e.target.value)}
                placeholder="Morada completa"
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={aGuardarMorada}
                  onClick={criarMorada}
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
                >
                  {aGuardarMorada ? "A guardar…" : "Guardar morada"}
                </button>
                {moradas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNovaMoradaAberta(false)}
                    className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Tipo</span>
        <select name="tipo" required defaultValue="" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
          <option value="" disabled>— Selecionar —</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Prioridade</span>
        <select name="prioridade" defaultValue="normal" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
          <option value="baixa">Baixa</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
        </select>
      </label>
      <label className="col-span-2 block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Descrição</span>
        <textarea name="descricao" required rows={3} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>

      <div className="col-span-2 mt-2 flex justify-end gap-2">
        <Link href="/admin/servicos" className="rounded-md border border-neutral-700 px-3.5 py-2 text-sm text-neutral-200">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={!podeGuardar}
          title={!podeGuardar ? "Seleciona o cliente e a morada primeiro" : undefined}
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Criar serviço
        </button>
      </div>
    </form>
  );
}
