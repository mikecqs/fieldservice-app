import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import {
  atribuirTecnico,
  removerTecnico,
  removerMaterialPlaneado,
  validarServico,
  enviarParaCorrecao,
  associarEquipamento,
  cancelarServico,
  criarOrcamentoDeVisita,
} from "../actions";
import { ESTADO_LABEL, ESTADO_COLOR } from "../estados";
import { AgendamentoForm } from "./AgendamentoForm";
import { ReativarServicoForm } from "./ReativarServicoForm";
import { MaterialPlaneadoForm } from "./MaterialPlaneadoForm";
import { calcularPreparacao, PREPARACAO_BADGE } from "@/lib/preparacao";
import {
  podeReagendarServico,
  podeCancelarServico,
  podeReativarServico,
  podeGerarOrcamentoDeVisita,
  podeVoltarAoOrcamentoDaVisita,
  podeVerPdfFecho,
  rotuloTipoServico,
} from "@/lib/servico-estado";
import { VerPdfFechoLink } from "@/components/VerPdfFechoLink";

const EVENTO_LABEL: Record<string, string> = {
  criado: "Criado",
  agendado: "Agendado",
  reagendado: "Reagendado",
  iniciado: "Iniciado",
  concluido: "Concluído",
  nova_visita: "Nova visita",
  nao_realizado: "Não realizado",
  correcao_pedida: "Correção pedida",
  corrigido: "Reaberto após correção",
  validado: "Validado",
  faturado: "Faturado",
  cancelado: "Cancelado",
  reativado: "Reativado",
};

export default async function ServicoDetalhePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const organizationId = await getOrgId();

  const [{ data: servico }, { data: tecnicos }, { data: visitas }, { data: validacoes }, { data: eventos }] = await Promise.all([
    supabase
      .from("services")
      .select("*, clients(nome, telefone, email), client_addresses(label, endereco), service_technicians(user_id, profiles(nome)), service_materials_planned(*)")
      .eq("id", params.id)
      .single(),
    supabase.from("profiles").select("id, nome").eq("organization_id", organizationId).eq("role", "TECHNICIAN").order("nome"),
    supabase
      .from("visits")
      .select("*, visit_materials_used(nome, qtd, preco_unit)")
      .eq("service_id", params.id)
      .order("data", { ascending: false }),
    supabase
      .from("service_validations")
      .select("acao, motivo, created_at, profiles(nome)")
      .eq("service_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_events")
      .select("tipo, descricao, created_at, profiles(nome)")
      .eq("service_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!servico) notFound();

  const { data: equipamentosCliente } = await supabase
    .from("client_equipment")
    .select("id, equipamento, marca, modelo")
    .eq("client_id", servico.client_id)
    .order("equipamento");

  const atribuidos = new Set((servico.service_technicians ?? []).map((t: any) => t.user_id));
  const disponiveis = (tecnicos ?? []).filter((t) => !atribuidos.has(t.id));

  const preparacao = calcularPreparacao({
    temTecnico: (servico.service_technicians ?? []).length > 0,
    morada: servico.client_addresses?.endereco,
    temContacto: !!(servico.clients?.telefone || servico.clients?.email),
    descricao: servico.descricao,
    dataAgendada: servico.data_agendada,
    horaAgendada: servico.hora_agendada,
    materialBloqueando: false,
  });
  const badgePreparacao = PREPARACAO_BADGE[preparacao.nivel];
  const previstoMap = new Map<string, number>(
    (servico.service_materials_planned ?? []).map((m: any) => [m.nome, Number(m.qtd)])
  );
  const mostrarPreparacao = ["por_agendar", "agendado", "nova_visita", "correcao_necessaria"].includes(servico.estado);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/servicos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Serviços
      </Link>

      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">{servico.codigo}</span>
              <h1 className="text-lg font-bold text-white">{servico.clients?.nome}</h1>
            </div>
            <p className="text-sm text-neutral-400">{rotuloTipoServico(servico.tipo)} · {servico.descricao}</p>
            {servico.client_addresses && (
              <p className="mt-1 text-xs text-neutral-500">{servico.client_addresses.label}: {servico.client_addresses.endereco}</p>
            )}
          </div>
          <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[servico.estado] ?? "bg-neutral-800 text-neutral-300"}`}>
            {ESTADO_LABEL[servico.estado] ?? servico.estado}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-200">
            {Number(servico.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </p>
          {/* Ação única "Ver PDF do Fecho" (Ponto 11) — mesmo componente do
              PainelFaturacao, nunca duas implementações. Só aparece depois de
              o Técnico ter fechado pelo menos uma vez (podeVerPdfFecho). */}
          {podeVerPdfFecho(servico) && <VerPdfFechoLink servicoId={servico.id} />}
        </div>
        {mostrarPreparacao && (
          <div className={`mt-3 flex items-start gap-2 rounded-md p-2.5 text-xs ${badgePreparacao.cls}`}>
            <Circle className={`mt-0.5 h-2.5 w-2.5 shrink-0 fill-current ${badgePreparacao.dotColor}`} aria-hidden="true" />
            <div>
              <span className="font-semibold">{badgePreparacao.label}</span>
              {preparacao.motivos.length > 0 && <span> — {preparacao.motivos.join(", ")}</span>}
            </div>
          </div>
        )}
        {servico.estado === "correcao_necessaria" && validacoes?.[0]?.motivo && (
          <div className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-400">
            <span className="font-semibold">Motivo da rejeição:</span> {validacoes[0].motivo}
          </div>
        )}

        {servico.estado === "aguarda_validacao" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-800 pt-4">
            <form action={validarServico}>
              <input type="hidden" name="id" value={servico.id} />
              <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
                Validar
              </button>
            </form>
            <details className="relative">
              <summary className="list-none cursor-pointer rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10">
                Mandar para trás
              </summary>
              <form
                action={enviarParaCorrecao}
                className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-lg"
              >
                <input type="hidden" name="id" value={servico.id} />
                <span className="block text-xs font-medium text-neutral-300">Motivo (obrigatório)</span>
                <textarea
                  name="motivo"
                  required
                  rows={3}
                  className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
                  placeholder="Ex: guia do Wintouch indica 5 câmaras, técnico registou 4."
                />
                <button className="w-full rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
                  Confirmar rejeição
                </button>
              </form>
            </details>
          </div>
        )}

        {podeCancelarServico(servico) && (
          <details className="mt-4 border-t border-neutral-800 pt-3">
            <summary className="cursor-pointer text-xs text-red-400 hover:text-red-300">Cancelar serviço</summary>
            <form action={cancelarServico} className="mt-2 space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <input type="hidden" name="id" value={servico.id} />
              <span className="block text-xs font-medium text-neutral-300">Motivo do cancelamento (obrigatório)</span>
              <textarea
                name="motivo"
                required
                rows={2}
                className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
                placeholder="Ex: cliente desistiu do serviço."
              />
              <p className="text-[11px] text-red-400/80">
                Esta ação fica registada no histórico do serviço e não pode ser desfeita.
              </p>
              <button className="w-full rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
                Confirmar cancelamento
              </button>
            </form>
          </details>
        )}
      </div>

      {podeGerarOrcamentoDeVisita(servico) && (
        <div className="mb-5 rounded-xl border border-sky-500/30 bg-neutral-900 p-6">
          <h2 className="mb-1 text-sm font-semibold text-neutral-100">Visita Prévia concluída</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Esta Visita Prévia já foi realizada. Podes agora gerar o Orçamento a partir dela.
          </p>
          <form action={criarOrcamentoDeVisita}>
            <input type="hidden" name="id" value={servico.id} />
            <button className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
              Criar orçamento a partir desta visita
            </button>
          </form>
        </div>
      )}

      {podeVoltarAoOrcamentoDaVisita(servico) && (
        <div className="mb-5 rounded-xl border border-sky-500/30 bg-neutral-900 p-6">
          <h2 className="mb-1 text-sm font-semibold text-neutral-100">Visita Prévia concluída</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Esta Visita Prévia foi feita para confirmar o Orçamento que a originou. Revê-o para confirmar ou ajustar o valor.
          </p>
          <Link
            href={`/admin/orcamentos/${servico.budget_id}`}
            className="inline-block rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Rever orçamento →
          </Link>
        </div>
      )}

      {podeReativarServico(servico) && (
        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-neutral-900 p-6">
          <h2 className="mb-1 text-sm font-semibold text-neutral-100">Reativar serviço</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Este serviço ficou "Não foi possível realizar". Define uma nova data/hora para o reagendar.
          </p>
          <ReativarServicoForm servicoId={servico.id} tecnicosDisponiveis={disponiveis} />
        </div>
      )}

      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Agendamento</h2>
        <AgendamentoForm servico={servico} />
      </div>

      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Técnicos atribuídos</h2>
        <div className="mb-3 space-y-1.5">
          {(servico.service_technicians ?? []).map((t: any) => (
            <div key={t.user_id} className="flex items-center justify-between rounded-md border border-neutral-800 p-2 text-sm">
              {t.profiles?.nome}
              {podeReagendarServico(servico) && (
                <form action={removerTecnico}>
                  <input type="hidden" name="service_id" value={servico.id} />
                  <input type="hidden" name="user_id" value={t.user_id} />
                  <button className="text-xs text-red-400 hover:underline">remover</button>
                </form>
              )}
            </div>
          ))}
          {(servico.service_technicians ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Ainda sem técnicos atribuídos.</p>
          )}
        </div>
        {!podeReagendarServico(servico) ? (
          <p className="flex items-start gap-1.5 text-xs text-neutral-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Técnicos já não podem ser alterados neste serviço (concluído, cancelado, não realizado, já faturado ou liquidado).
          </p>
        ) : (
          disponiveis.length > 0 && (
            <form action={atribuirTecnico} className="flex gap-2">
              <input type="hidden" name="service_id" value={servico.id} />
              <select name="user_id" className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-sm">
                {disponiveis.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              <button className="rounded-md bg-white px-3 py-2 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
                Atribuir
              </button>
            </form>
          )
        )}
      </div>

      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Materiais planeados</h2>
        <div className="mb-3 space-y-1.5">
          {(servico.service_materials_planned ?? []).map((m: any) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-md border border-neutral-800 p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="break-words">
                {m.nome} · {m.qtd}
                {Number(m.preco_venda) > 0 && (
                  <span className="ml-1 text-neutral-500">
                    · {Number(m.preco_venda).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {podeReagendarServico(servico) && (
                  <details className="relative">
                    <summary className="list-none cursor-pointer text-xs text-red-400 hover:underline">remover</summary>
                    <form
                      action={removerMaterialPlaneado}
                      className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-lg"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="service_id" value={servico.id} />
                      <p className="mb-2 text-xs text-neutral-300">Remover "{m.nome}" da lista de materiais planeados?</p>
                      <button className="w-full rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
                        Confirmar remoção
                      </button>
                    </form>
                  </details>
                )}
              </div>
            </div>
          ))}
          {(servico.service_materials_planned ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Sem materiais planeados.</p>
          )}
        </div>
        {!podeReagendarServico(servico) ? (
          <p className="flex items-start gap-1.5 text-xs text-neutral-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Materiais planeados já não podem ser alterados neste serviço (concluído, cancelado, não realizado, já faturado ou liquidado).
          </p>
        ) : (
          <MaterialPlaneadoForm serviceId={servico.id} />
        )}
      </div>

      {(equipamentosCliente ?? []).length > 0 && (
        <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">Equipamento relacionado</h2>
          <form action={associarEquipamento} className="flex gap-2">
            <input type="hidden" name="id" value={servico.id} />
            <select name="equipment_id" defaultValue={servico.equipment_id ?? ""} className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-sm">
              <option value="">— Nenhum —</option>
              {(equipamentosCliente ?? []).map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.equipamento}{e.marca ? ` · ${e.marca}` : ""}{e.modelo ? ` ${e.modelo}` : ""}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-white px-3 py-2 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
              Guardar
            </button>
          </form>
          <Link href={`/admin/clientes/${servico.client_id}`} className="mt-2 inline-block text-xs text-neutral-200 underline">
            Ver equipamentos e histórico do cliente →
          </Link>
        </div>
      )}

      {(eventos ?? []).length > 0 && (
        <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">Histórico</h2>
          <div className="space-y-2">
            {(eventos ?? []).map((e: any, i: number) => (
              <div key={i} className="rounded-md border border-neutral-800 p-3 text-sm">
                <div className="mb-1 flex justify-between text-xs text-neutral-400">
                  <span className="font-semibold text-neutral-200">{EVENTO_LABEL[e.tipo] ?? e.tipo}</span>
                  <span>{new Date(e.created_at).toLocaleString("pt-PT")} · {e.profiles?.nome ?? "—"}</span>
                </div>
                <p className="text-neutral-200">{e.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(visitas ?? []).length > 0 && (
        <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">Histórico de visitas</h2>
          <div className="space-y-2">
            {(visitas ?? []).map((v: any) => (
              <div key={v.id} className="rounded-md border border-neutral-800 p-3 text-sm">
                <div className="mb-1 flex justify-between text-xs text-neutral-500">
                  <span>{v.data}</span>
                  <span>{v.resultado ?? "em curso"}</span>
                </div>
                {v.trabalho_realizado && <p className="text-neutral-200">{v.trabalho_realizado}</p>}
                {(v.visit_materials_used ?? []).length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-neutral-800 pt-2">
                    {(v.visit_materials_used ?? []).map((m: any, i: number) => {
                      const previsto = previstoMap.get(m.nome);
                      const difere = previsto !== undefined && previsto !== Number(m.qtd);
                      return (
                        <div key={i} className="flex items-center justify-between text-xs text-neutral-400">
                          <span>
                            {m.nome} × {m.qtd}
                            {difere && (
                              <span className="ml-1.5 text-amber-400">(previsto: {previsto})</span>
                            )}
                          </span>
                          <span>
                            {(Number(m.qtd) * Number(m.preco_unit)).toLocaleString("pt-PT", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {v.valor_calculado != null && (
                  <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-xs font-semibold text-neutral-200">
                    <span>Valor calculado (materiais + mão de obra)</span>
                    <span>
                      {Number(v.valor_calculado).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(validacoes ?? []).length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">Histórico de validações</h2>
          <div className="space-y-2">
            {(validacoes ?? []).map((v: any, i: number) => (
              <div
                key={i}
                className={`rounded-md border p-3 text-sm ${
                  v.acao === "validado" ? "border-emerald-500/20 bg-emerald-500/10" : "border-red-500/20 bg-red-500/10"
                }`}
              >
                <div className="mb-1 flex justify-between text-xs text-neutral-400">
                  <span className="font-semibold">{v.acao === "validado" ? "Validado" : "Rejeitado"}</span>
                  <span>{new Date(v.created_at).toLocaleString("pt-PT")} · {v.profiles?.nome}</span>
                </div>
                {v.motivo && <p className="text-neutral-200">{v.motivo}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
