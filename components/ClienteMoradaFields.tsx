"use client";

import { useState } from "react";
import { criarClienteRapido, criarMoradaRapida } from "@/app/admin/clientes/actions";

export type MoradaSelecao = { id: string; label: string; endereco: string };
export type ClienteSelecao = {
  id: string;
  nome: string;
  codigo?: string | null;
  nif?: string | null;
  telefone?: string | null;
  client_addresses: MoradaSelecao[];
};

// Onda 3 (Etapa 4) — bloco "Cliente (+criar) → Morada (+criar)" partilhado
// por NovoPedidoForm, ServicoModal (Agenda) e NovoServicoForm, que antes
// tinham cada um a sua própria cópia deste UI/estado (só as Server Actions
// `criarClienteRapido`/`criarMoradaRapida` já eram partilhadas).
//
// Deliberadamente FINO: este componente nunca renderiza `<form>`, nunca põe
// `name`/`required` nos seus próprios campos, e nunca decide como
// `clientId`/`addressId` chegam à submissão de cada formulário-pai — isso
// continua a ser feito por cada chamador (inputs escondidos, `name` nativo,
// ou uma chamada direta à Server Action), exatamente como já era. O
// componente só gere: a lista de clientes/moradas visível, a seleção, a
// auto-seleção da morada única (Etapa 1), e a criação rápida de
// cliente/morada — sempre através das mesmas Server Actions de sempre.
//
// Diferenças legítimas entre os 3 usos, preservadas via props (não forçadas
// a serem iguais):
// - NovoPedidoForm pede nome+telefone+email ao criar cliente e mostra o
//   código do cliente (CLI-XXXXXX) nas opções — `camposNovoCliente="completo"`
//   + `mostrarCodigoCliente`; tem pesquisa quando há muitos clientes —
//   `permitirPesquisa`.
// - ServicoModal só pede nome ao criar cliente — `camposNovoCliente="nome"`.
// - NovoServicoForm não permite criar cliente aqui (decisão de produto já
//   existente, não alterada nesta onda) — `permitirNovoCliente={false}`.
export function ClienteMoradaFields({
  clientes,
  onClientesChange,
  clientId,
  onClientIdChange,
  addressId,
  onAddressIdChange,
  onErro,
  permitirNovoCliente = true,
  camposNovoCliente = "completo",
  permitirPesquisa = false,
  mostrarCodigoCliente = false,
  className = "block",
}: {
  clientes: ClienteSelecao[];
  onClientesChange: (clientes: ClienteSelecao[]) => void;
  clientId: string;
  onClientIdChange: (id: string) => void;
  addressId: string;
  onAddressIdChange: (id: string) => void;
  // Reporta erros de criação de cliente/morada para o formulário-pai gerir
  // (cada um já tinha o seu próprio estado/local de erro — este componente
  // nunca decide onde/como aparece).
  onErro: (mensagem: string | null) => void;
  permitirNovoCliente?: boolean;
  camposNovoCliente?: "nome" | "completo";
  permitirPesquisa?: boolean;
  mostrarCodigoCliente?: boolean;
  className?: string;
}) {
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [aGuardarCliente, setAGuardarCliente] = useState(false);

  const [novaMoradaAberta, setNovaMoradaAberta] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState("");
  const [aGuardarMorada, setAGuardarMorada] = useState(false);

  const [filtro, setFiltro] = useState("");

  const clienteSelecionado = clientes.find((c) => c.id === clientId);
  const moradas = clienteSelecionado?.client_addresses ?? [];
  const clientesFiltrados =
    permitirPesquisa && filtro.trim()
      ? clientes.filter((c) => {
          const termo = filtro.trim().toLowerCase();
          return (
            c.nome.toLowerCase().includes(termo) ||
            (c.nif ?? "").toLowerCase().includes(termo) ||
            (c.telefone ?? "").toLowerCase().includes(termo)
          );
        })
      : clientes;

  function selecionarCliente(id: string) {
    onClientIdChange(id);
    // Etapa 1 — só uma morada possível: já fica selecionada, mas continua
    // trocável (o <select> mostra-a normalmente, só não fica em branco).
    const cliente = clientes.find((c) => c.id === id);
    onAddressIdChange(cliente?.client_addresses.length === 1 ? cliente.client_addresses[0].id : "");
    setNovaMoradaAberta(false);
  }

  async function criarCliente() {
    onErro(null);
    if (!novoNome.trim()) {
      onErro("Nome do cliente é obrigatório.");
      return;
    }
    setAGuardarCliente(true);
    try {
      const novo = await criarClienteRapido(
        camposNovoCliente === "completo"
          ? { nome: novoNome, telefone: novoTelefone, email: novoEmail }
          : { nome: novoNome }
      );
      onClientesChange([...clientes, { ...novo, client_addresses: [] }]);
      selecionarCliente(novo.id);
      setNovoClienteAberto(false);
      setNovoNome("");
      setNovoTelefone("");
      setNovoEmail("");
      // Cliente novo nunca tem moradas — abre logo a criação da primeira.
      setNovaMoradaAberta(true);
    } catch (e: any) {
      onErro(e?.message || "Não foi possível criar o cliente.");
    } finally {
      setAGuardarCliente(false);
    }
  }

  async function criarMorada() {
    onErro(null);
    if (!novoEndereco.trim() || !clientId) {
      onErro("Morada é obrigatória.");
      return;
    }
    setAGuardarMorada(true);
    try {
      const nova = await criarMoradaRapida({ client_id: clientId, endereco: novoEndereco });
      onClientesChange(
        clientes.map((c) => (c.id === clientId ? { ...c, client_addresses: [...c.client_addresses, nova] } : c))
      );
      onAddressIdChange(nova.id);
      setNovaMoradaAberta(false);
      setNovoEndereco("");
    } catch (e: any) {
      onErro(e?.message || "Não foi possível criar a morada.");
    } finally {
      setAGuardarMorada(false);
    }
  }

  return (
    <>
      <label className={className}>
        <span className="mb-1 block text-xs font-medium text-neutral-300">Cliente</span>
        {!novoClienteAberto ? (
          <div className="space-y-1.5">
            {permitirPesquisa && clientes.length > 6 && (
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Procurar por nome, NIF ou telefone…"
                className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
              />
            )}
            <select
              value={clientId}
              onChange={(e) => selecionarCliente(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            >
              <option value="">— Selecionar cliente —</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {mostrarCodigoCliente && c.codigo ? ` · ${c.codigo}` : ""}
                  {c.telefone ? ` · ${c.telefone}` : ""}
                </option>
              ))}
            </select>
            {permitirNovoCliente && (
              <button
                type="button"
                onClick={() => setNovoClienteAberto(true)}
                className="text-xs font-medium text-neutral-300 underline hover:text-white"
              >
                + Criar cliente novo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-800 p-3">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder={camposNovoCliente === "completo" ? "Nome" : "Nome do cliente"}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
            {camposNovoCliente === "completo" && (
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
            )}
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
      </label>

      {clientId && (
        <label className={className}>
          <span className="mb-1 block text-xs font-medium text-neutral-300">Morada</span>
          {!novaMoradaAberta ? (
            <div className="space-y-1.5">
              {moradas.length > 0 && (
                <select
                  value={addressId}
                  onChange={(e) => onAddressIdChange(e.target.value)}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
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
        </label>
      )}
    </>
  );
}
