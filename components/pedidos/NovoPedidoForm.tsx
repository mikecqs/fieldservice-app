"use client";

import { useState } from "react";
import Link from "next/link";
import { criarPedido } from "@/app/admin/pedidos/actions";
import { criarClienteRapido, criarMoradaRapida } from "@/app/admin/clientes/actions";

type Morada = { id: string; label: string; endereco: string };
type Cliente = { id: string; nome: string; codigo?: string | null; client_addresses: Morada[] };

// Formulário partilhado por /admin/pedidos/novo e /atendimento/pedidos/novo —
// mesmo fluxo rápido de loja para as duas roles: Cliente → Morada → Tipo →
// Origem → Descrição → Guardar. As moradas mostradas vêm sempre só do
// `client_addresses` já aninhado do cliente selecionado (nunca uma lista
// solta filtrada por id), por isso nunca é possível misturar a morada de um
// cliente com o pedido de outro.
export function NovoPedidoForm({
  clientesIniciais,
  tipos,
  origens,
  showInfoFalta,
  voltarHref,
  clientIdInicial,
}: {
  clientesIniciais: Cliente[];
  tipos: string[];
  origens: string[];
  showInfoFalta: boolean;
  voltarHref: string;
  // Vindo de "Novo cliente → Sim, criar pedido" (BLOCO 4) — pré-seleciona o
  // cliente sem obrigar a procurá-lo outra vez. Só é usado se o id vier
  // mesmo na lista de clientes recebida (nunca confiar cegamente num
  // parâmetro de URL).
  clientIdInicial?: string;
}) {
  const [clientes, setClientes] = useState(clientesIniciais);
  const [clientId, setClientId] = useState(
    clientIdInicial && clientesIniciais.some((c) => c.id === clientIdInicial) ? clientIdInicial : ""
  );
  const [addressId, setAddressId] = useState("");
  const [filtro, setFiltro] = useState("");

  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [aGuardarCliente, setAGuardarCliente] = useState(false);

  const [novaMoradaAberta, setNovaMoradaAberta] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState("");
  const [aGuardarMorada, setAGuardarMorada] = useState(false);

  const [erro, setErro] = useState<string | null>(null);

  const clienteSelecionado = clientes.find((c) => c.id === clientId);
  const moradas = clienteSelecionado?.client_addresses ?? [];
  const clientesFiltrados = filtro.trim()
    ? clientes.filter((c) => c.nome.toLowerCase().includes(filtro.trim().toLowerCase()))
    : clientes;

  function selecionarCliente(id: string) {
    setClientId(id);
    setAddressId("");
    setNovaMoradaAberta(false);
  }

  async function criarCliente() {
    setErro(null);
    if (!novoNome.trim()) {
      setErro("Nome do cliente é obrigatório.");
      return;
    }
    setAGuardarCliente(true);
    try {
      const novo = await criarClienteRapido({ nome: novoNome, telefone: novoTelefone, email: novoEmail });
      setClientes((prev) => [...prev, { ...novo, client_addresses: [] }]);
      selecionarCliente(novo.id);
      setNovoClienteAberto(false);
      setNovoNome("");
      setNovoTelefone("");
      setNovoEmail("");
      // Cliente novo nunca tem moradas — abre logo a criação da primeira.
      setNovaMoradaAberta(true);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar o cliente.");
    } finally {
      setAGuardarCliente(false);
    }
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
      setClientes((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, client_addresses: [...c.client_addresses, nova] } : c))
      );
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
    <form action={criarPedido} className="grid grid-cols-1 gap-4">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="address_id" value={addressId} />

      {erro && <p className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-400">{erro}</p>}

      <div>
        <span className="mb-1 block text-xs font-medium text-neutral-300">Cliente</span>
        {!novoClienteAberto ? (
          <div className="space-y-2">
            {clientes.length > 6 && (
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Procurar cliente…"
                className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
              />
            )}
            <select
              value={clientId}
              onChange={(e) => selecionarCliente(e.target.value)}
              className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
            >
              <option value="">— Selecionar cliente —</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.codigo ? ` · ${c.codigo}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNovoClienteAberto(true)}
              className="text-xs font-medium text-neutral-300 underline hover:text-white"
            >
              + Criar cliente novo
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-800 p-3">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
                placeholder="Telefone"
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
              <input
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="Email"
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={aGuardarCliente}
                onClick={criarCliente}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
              >
                {aGuardarCliente ? "A criar…" : "Criar e selecionar"}
              </button>
              <button
                type="button"
                onClick={() => setNovoClienteAberto(false)}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {clientId && (
        <div>
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
                    <option key={m.id} value={m.id}>
                      {m.label}: {m.endereco}
                    </option>
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
          <option value="" disabled>
            — Selecionar —
          </option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Origem</span>
        <select name="origem" required defaultValue="" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
          <option value="" disabled>
            — Selecionar —
          </option>
          {origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Descrição</span>
        <textarea name="descricao" required rows={3} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>

      {showInfoFalta && (
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="info_falta" className="rounded border-neutral-700" />
          Falta informação do cliente para avançar
        </label>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Link href={voltarHref} className="rounded-md border border-neutral-700 px-3.5 py-2 text-sm text-neutral-200">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={!podeGuardar}
          title={!podeGuardar ? "Seleciona o cliente e a morada primeiro" : undefined}
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar pedido
        </button>
      </div>
    </form>
  );
}
