"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { criarOuAgendarNoPopup } from "./actions";
import { verificarConflitoAgenda, atualizarAgendamento, atribuirTecnico, removerTecnico } from "../servicos/actions";
import { criarClienteRapido, criarMoradaRapida } from "../clientes/actions";
import { ESTADO_LABEL, ESTADO_COLOR } from "../servicos/estados";
import { podeReagendarServico } from "@/lib/servico-estado";

const TIPOS_SERVICO = ["Agendamento", "Orçamento", "Manutenção", "Instalação"];

export type ServicoAgenda = {
  id: string;
  tipo: string;
  descricao: string;
  estado: string;
  faturacao_estado?: string | null;
  data_agendada: string | null;
  hora_agendada: string | null;
  hora_fim_agendada: string | null;
  prioridade: string;
  notas: string | null;
  client_id: string;
  clients: { nome: string; telefone: string | null } | null;
  service_technicians: { user_id: string; profiles: { nome: string } | null }[];
};

type Pessoa = { id: string; nome: string };
type Morada = { id: string; label: string; endereco: string };
type Cliente = { id: string; nome: string; client_addresses: Morada[] };
type PedidoOpcao = { id: string; tipo: string; descricao: string; client_id: string; clients: { nome: string } | null };
type ServicoOpcao = { id: string; tipo: string; descricao: string; client_id: string; clients: { nome: string } | null };

export function ServicoModal({
  mode,
  servico,
  slot,
  clientes,
  tecnicos,
  pedidosAbertos,
  servicosPendentes,
  onClose,
  onSaved,
}: {
  mode: "ver" | "criar";
  servico?: ServicoAgenda | null;
  slot?: { data: string; horaInicio: string; horaFim: string } | null;
  clientes: Cliente[];
  tecnicos: Pessoa[];
  pedidosAbertos: PedidoOpcao[];
  servicosPendentes: ServicoOpcao[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [subModo, setSubModo] = useState<"existente" | "novo">(servicosPendentes.length > 0 ? "existente" : "novo");
  const [servicoExistenteId, setServicoExistenteId] = useState("");
  const [listaClientes, setListaClientes] = useState(clientes);
  const [clientId, setClientId] = useState(servico?.client_id ?? "");
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [aGuardarCliente, setAGuardarCliente] = useState(false);
  const [addressId, setAddressId] = useState("");
  const [novaMoradaAberta, setNovaMoradaAberta] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState("");
  const [aGuardarMorada, setAGuardarMorada] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [tipo, setTipo] = useState(servico?.tipo ?? "");
  const [descricao, setDescricao] = useState(servico?.descricao ?? "");
  const [prioridade, setPrioridade] = useState(servico?.prioridade ?? "normal");
  const [notas, setNotas] = useState(servico?.notas ?? "");
  const [data, setData] = useState(servico?.data_agendada ?? slot?.data ?? "");
  const [horaInicio, setHoraInicio] = useState(servico?.hora_agendada?.slice(0, 5) ?? slot?.horaInicio ?? "");
  const [horaFim, setHoraFim] = useState(servico?.hora_fim_agendada?.slice(0, 5) ?? slot?.horaFim ?? "");
  const [tecnicoId, setTecnicoId] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<string | null>(null);
  const [confirmouConflito, setConfirmouConflito] = useState(false);

  useEffect(() => {
    setConflito(null);
    setConfirmouConflito(false);
  }, [data, horaInicio, horaFim, tecnicoId]);

  const servicoSelecionado = servicosPendentes.find((s) => s.id === servicoExistenteId);
  const pedidosDoCliente = pedidosAbertos.filter((p) => p.client_id === clientId);
  const tecnicosAtuais = servico?.service_technicians ?? [];
  const clienteSelecionado = listaClientes.find((c) => c.id === clientId);
  const moradas = clienteSelecionado?.client_addresses ?? [];

  const guardar = async () => {
    setErro(null);
    if (!data || !horaInicio || !horaFim) {
      setErro("Data, hora de início e hora de fim são obrigatórias.");
      return;
    }
    if (horaFim <= horaInicio) {
      setErro("A hora de término deve ser depois da hora de início.");
      return;
    }

    if (mode === "criar" && subModo === "existente" && !servicoExistenteId) {
      setErro("Seleciona o serviço a agendar.");
      return;
    }
    if (mode === "criar" && subModo === "novo" && (!clientId || !addressId || !tipo || !descricao)) {
      setErro("Cliente, morada, tipo e descrição são obrigatórios.");
      return;
    }

    // Aviso de conflito não-bloqueante: só verificamos quando já há técnico
    // selecionado (sem técnico não há conflito possível) e ainda não foi
    // confirmado "agendar na mesma" para esta combinação.
    if (!confirmouConflito) {
      const idParaExcluir = mode === "ver" ? servico!.id : subModo === "existente" ? servicoExistenteId : undefined;
      const idsExistentes = tecnicosAtuais.map((t) => t.user_id);
      const idsTecnicos = tecnicoId && !idsExistentes.includes(tecnicoId) ? [...idsExistentes, tecnicoId] : idsExistentes;
      if (idsTecnicos.length > 0) {
        const resultado = await verificarConflitoAgenda({
          serviceId: idParaExcluir || undefined,
          technicianIds: idsTecnicos,
          data,
          horaInicio,
          horaFim,
        });
        if (resultado.conflito) {
          setConflito(resultado.mensagem);
          return;
        }
      }
    }

    setAGuardar(true);
    try {
      if (mode === "ver" && servico) {
        const fd = new FormData();
        fd.set("id", servico.id);
        fd.set("data_agendada", data);
        fd.set("hora_agendada", horaInicio);
        fd.set("hora_fim_agendada", horaFim);
        fd.set("prioridade", prioridade);
        fd.set("notas", notas);
        await atualizarAgendamento(fd);

        if (tecnicoId && !tecnicosAtuais.some((t) => t.user_id === tecnicoId)) {
          const fdT = new FormData();
          fdT.set("service_id", servico.id);
          fdT.set("user_id", tecnicoId);
          await atribuirTecnico(fdT);
        }
      } else {
        await criarOuAgendarNoPopup({
          existingServiceId: subModo === "existente" ? servicoExistenteId : null,
          clientId: subModo === "novo" ? clientId : null,
          addressId: subModo === "novo" ? addressId : null,
          requestId: subModo === "novo" ? requestId || null : null,
          tipo: subModo === "novo" ? tipo : null,
          descricao: subModo === "novo" ? descricao : null,
          prioridade,
          data,
          horaInicio,
          horaFim,
          tecnicoId: tecnicoId || null,
        });
      }
      onSaved();
    } catch (e: any) {
      setErro(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  };

  const removerEsteTecnico = async (userId: string) => {
    if (!servico) return;
    const fd = new FormData();
    fd.set("service_id", servico.id);
    fd.set("user_id", userId);
    await removerTecnico(fd);
    onSaved();
  };

  const criarClienteInline = async () => {
    setErro(null);
    if (!novoClienteNome.trim()) {
      setErro("Nome do cliente é obrigatório.");
      return;
    }
    setAGuardarCliente(true);
    try {
      const novo = await criarClienteRapido({ nome: novoClienteNome });
      setListaClientes((prev) => [...prev, { ...novo, client_addresses: [] }]);
      setClientId(novo.id);
      setAddressId("");
      setRequestId("");
      setNovoClienteAberto(false);
      setNovoClienteNome("");
      // Cliente novo nunca tem moradas — abre logo a criação da primeira.
      setNovaMoradaAberta(true);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar o cliente.");
    } finally {
      setAGuardarCliente(false);
    }
  };

  const criarMoradaInline = async () => {
    setErro(null);
    if (!novoEndereco.trim() || !clientId) {
      setErro("Morada é obrigatória.");
      return;
    }
    setAGuardarMorada(true);
    try {
      const nova = await criarMoradaRapida({ client_id: clientId, endereco: novoEndereco });
      setListaClientes((prev) =>
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
  };

  // Mesma regra do servidor (lib/servico-estado.ts) — um serviço já
  // concluído/cancelado/não realizado/faturado deixa de ser editável a
  // partir daqui; só consulta rápida + link para a ficha completa.
  if (mode === "ver" && servico && !podeReagendarServico(servico)) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
        <div
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl sm:rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-white">{servico.clients?.nome}</h2>
              <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[servico.estado] ?? "bg-neutral-800 text-neutral-300"}`}>
                {ESTADO_LABEL[servico.estado] ?? servico.estado}
              </span>
            </div>
            <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800">
              Fechar ✕
            </button>
          </div>

          <div className="space-y-2 text-sm text-neutral-300">
            <p>{servico.tipo} · {servico.descricao}</p>
            <p className="text-neutral-400">
              {servico.data_agendada ?? "sem data"} {servico.hora_agendada?.slice(0, 5) ?? ""}
              {servico.hora_fim_agendada ? `–${servico.hora_fim_agendada.slice(0, 5)}` : ""}
            </p>
            {tecnicosAtuais.length > 0 && (
              <p className="text-neutral-400">
                Técnico(s): {tecnicosAtuais.map((t) => t.profiles?.nome).filter(Boolean).join(", ")}
              </p>
            )}
            <div className="rounded-md border border-neutral-800 bg-neutral-800/50 p-3 text-xs text-neutral-400">
              🔒 Este serviço já não pode ser editado (concluído, cancelado, não realizado ou já faturado).
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Link href={`/admin/servicos/${servico.id}`} className="text-xs text-neutral-400 underline">
              Ver ficha completa →
            </Link>
            <button onClick={onClose} className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200">
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {mode === "ver" ? servico?.clients?.nome : "Novo agendamento"}
            </h2>
            {mode === "ver" && servico && (
              <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[servico.estado] ?? "bg-neutral-800 text-neutral-300"}`}>
                {ESTADO_LABEL[servico.estado] ?? servico.estado}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800">
            Fechar ✕
          </button>
        </div>

        <div className="space-y-3">
          {mode === "ver" && servico && (
            <p className="text-sm text-neutral-300">
              {servico.tipo} · {servico.descricao}
              {servico.clients?.telefone && <span className="text-neutral-500"> · {servico.clients.telefone}</span>}
            </p>
          )}

          {mode === "criar" && (
            <>
              {servicosPendentes.length > 0 && (
                <div className="flex overflow-hidden rounded-md border border-neutral-700 text-xs">
                  <button
                    onClick={() => setSubModo("existente")}
                    className={`flex-1 px-2 py-1.5 ${subModo === "existente" ? "bg-white text-neutral-950" : "text-neutral-300"}`}
                  >
                    Serviço existente
                  </button>
                  <button
                    onClick={() => setSubModo("novo")}
                    className={`flex-1 px-2 py-1.5 ${subModo === "novo" ? "bg-white text-neutral-950" : "text-neutral-300"}`}
                  >
                    Criar novo
                  </button>
                </div>
              )}

              {subModo === "existente" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-300">Serviço por agendar</span>
                  <select
                    value={servicoExistenteId}
                    onChange={(e) => setServicoExistenteId(e.target.value)}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                  >
                    <option value="">Seleciona…</option>
                    {servicosPendentes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.clients?.nome} — {s.tipo} · {s.descricao}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-neutral-300">Cliente</span>
                    {!novoClienteAberto ? (
                      <div className="space-y-1.5">
                        <select
                          value={clientId}
                          onChange={(e) => {
                            setClientId(e.target.value);
                            setRequestId("");
                            setAddressId("");
                            setNovaMoradaAberta(false);
                          }}
                          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                        >
                          <option value="">Seleciona…</option>
                          {listaClientes.map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
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
                          value={novoClienteNome}
                          onChange={(e) => setNovoClienteNome(e.target.value)}
                          placeholder="Nome do cliente"
                          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={aGuardarCliente}
                            onClick={criarClienteInline}
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
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-neutral-300">Morada</span>
                      {!novaMoradaAberta ? (
                        <div className="space-y-1.5">
                          {moradas.length > 0 && (
                            <select
                              value={addressId}
                              onChange={(e) => setAddressId(e.target.value)}
                              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
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
                              onClick={criarMoradaInline}
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

                  {pedidosDoCliente.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-neutral-300">Pedido existente (opcional)</span>
                      <select
                        value={requestId}
                        onChange={(e) => {
                          setRequestId(e.target.value);
                          const p = pedidosDoCliente.find((p) => p.id === e.target.value);
                          if (p) {
                            setTipo(p.tipo);
                            setDescricao(p.descricao);
                          }
                        }}
                        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                      >
                        <option value="">Nenhum</option>
                        {pedidosDoCliente.map((p) => (
                          <option key={p.id} value={p.id}>{p.tipo} · {p.descricao}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-neutral-300">Tipo de serviço</span>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                    >
                      <option value="">Seleciona…</option>
                      {TIPOS_SERVICO.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-neutral-300">Descrição</span>
                    <textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
                  </label>
                </>
              )}
            </>
          )}

          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-1 block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Data</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full rounded-md border border-neutral-700 px-2 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Início</span>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full rounded-md border border-neutral-700 px-2 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Término</span>
              <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className="w-full rounded-md border border-neutral-700 px-2 py-2 text-sm" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-300">Técnico {mode === "ver" ? "(adicionar)" : ""}</span>
            <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
              <option value="">{mode === "ver" ? "Adicionar técnico…" : "Seleciona…"}</option>
              {tecnicos.filter((t) => !tecnicosAtuais.some((a) => a.user_id === t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </label>

          {mode === "ver" && tecnicosAtuais.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tecnicosAtuais.map((t) => (
                <span key={t.user_id} className="flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-200">
                  {t.profiles?.nome}
                  <button onClick={() => removerEsteTecnico(t.user_id)} className="text-neutral-500 hover:text-red-400">✕</button>
                </span>
              ))}
            </div>
          )}

          {mode === "ver" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-300">Prioridade</span>
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-300">Notas</span>
                <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
              </label>
            </>
          )}

          {conflito && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <p className="font-semibold">⚠️ Conflito de agenda</p>
              <p className="mt-1">{conflito}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setConflito(null)} className="flex-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setConfirmouConflito(true);
                    setConflito(null);
                  }}
                  className="flex-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Agendar na mesma
                </button>
              </div>
            </div>
          )}

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            {mode === "ver" && servico && (
              <Link href={`/admin/servicos/${servico.id}`} className="text-xs text-neutral-400 underline">
                Ver ficha completa →
              </Link>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={onClose} className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={aGuardar || !!conflito}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-40"
              >
                {aGuardar ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
