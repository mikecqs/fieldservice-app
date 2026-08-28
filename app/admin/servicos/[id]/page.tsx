import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import {
  mudarEstado,
  atribuirTecnico,
  removerTecnico,
  adicionarMaterialPlaneado,
  removerMaterialPlaneado,
  validarServico,
  enviarParaCorrecao,
} from "../actions";
import { ESTADO_LABEL, ESTADO_COLOR } from "../estados";
import { AgendamentoForm } from "./AgendamentoForm";

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
};

// 'aguarda_validacao' e 'correcao_necessaria' não estão aqui de propósito:
// só se chega lá pelas ações Validar / Mandar para trás (abaixo), nunca por
// este seletor manual — assim o motivo da rejeição é sempre obrigatório.
const ESTADOS = ["por_agendar", "agendado", "em_curso", "concluido", "nova_visita", "nao_realizado", "cancelado"];

export default async function ServicoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const organizationId = await getOrgId();

  const [{ data: servico }, { data: tecnicos }, { data: visitas }, { data: validacoes }, { data: eventos }] = await Promise.all([
    supabase
      .from("services")
      .select("*, clients(nome), client_addresses(label, endereco), service_technicians(user_id, profiles(nome)), service_materials_planned(*)")
      .eq("id", params.id)
      .single(),
    supabase.from("profiles").select("id, nome").eq("organization_id", organizationId).eq("role", "TECHNICIAN").order("nome"),
    supabase.from("visits").select("*").eq("service_id", params.id).order("data", { ascending: false }),
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

  const atribuidos = new Set((servico.service_technicians ?? []).map((t: any) => t.user_id));
  const disponiveis = (tecnicos ?? []).filter((t) => !atribuidos.has(t.id));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/servicos" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Serviços
      </Link>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{servico.clients?.nome}</h1>
            <p className="text-sm text-slate-500">{servico.tipo} · {servico.descricao}</p>
            {servico.client_addresses && (
              <p className="mt-1 text-xs text-slate-400">{servico.client_addresses.label}: {servico.client_addresses.endereco}</p>
            )}
          </div>
          <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[servico.estado] ?? "bg-slate-100 text-slate-600"}`}>
            {ESTADO_LABEL[servico.estado] ?? servico.estado}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          {Number(servico.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
        </p>
        {servico.estado === "correcao_necessaria" && validacoes?.[0]?.motivo && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <span className="font-semibold">Motivo da rejeição:</span> {validacoes[0].motivo}
          </div>
        )}

        {servico.estado === "aguarda_validacao" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <form action={validarServico}>
              <input type="hidden" name="id" value={servico.id} />
              <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
                Validar
              </button>
            </form>
            <details className="relative">
              <summary className="list-none cursor-pointer rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                Mandar para trás
              </summary>
              <form
                action={enviarParaCorrecao}
                className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
              >
                <input type="hidden" name="id" value={servico.id} />
                <span className="block text-xs font-medium text-slate-600">Motivo (obrigatório)</span>
                <textarea
                  name="motivo"
                  required
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  placeholder="Ex: guia do Wintouch indica 5 câmaras, técnico registou 4."
                />
                <button className="w-full rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
                  Confirmar rejeição
                </button>
              </form>
            </details>
          </div>
        )}

        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">Forçar estado manualmente</summary>
          <form action={mudarEstado} className="mt-2 flex items-center gap-1.5">
            <input type="hidden" name="id" value={servico.id} />
            <select
              name="estado"
              defaultValue={ESTADOS.includes(servico.estado) ? servico.estado : ""}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
            >
              {!ESTADOS.includes(servico.estado) && <option value="" disabled>—</option>}
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
              ))}
            </select>
            <button className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800">
              Aplicar
            </button>
          </form>
        </details>
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Agendamento</h2>
        <AgendamentoForm servico={servico} />
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Técnicos atribuídos</h2>
        <div className="mb-3 space-y-1.5">
          {(servico.service_technicians ?? []).map((t: any) => (
            <div key={t.user_id} className="flex items-center justify-between rounded-md border border-slate-100 p-2 text-sm">
              {t.profiles?.nome}
              <form action={removerTecnico}>
                <input type="hidden" name="service_id" value={servico.id} />
                <input type="hidden" name="user_id" value={t.user_id} />
                <button className="text-xs text-red-600 hover:underline">remover</button>
              </form>
            </div>
          ))}
          {(servico.service_technicians ?? []).length === 0 && (
            <p className="text-sm text-slate-400">Ainda sem técnicos atribuídos.</p>
          )}
        </div>
        {disponiveis.length > 0 && (
          <form action={atribuirTecnico} className="flex gap-2">
            <input type="hidden" name="service_id" value={servico.id} />
            <select name="user_id" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
              {disponiveis.map((t: any) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <button className="rounded-md bg-indigo-900 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-800">
              Atribuir
            </button>
          </form>
        )}
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Materiais planeados</h2>
        <div className="mb-3 space-y-1.5">
          {(servico.service_materials_planned ?? []).map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-slate-100 p-2 text-sm">
              {m.nome} · {m.qtd}
              <form action={removerMaterialPlaneado}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="service_id" value={servico.id} />
                <button className="text-xs text-red-600 hover:underline">remover</button>
              </form>
            </div>
          ))}
          {(servico.service_materials_planned ?? []).length === 0 && (
            <p className="text-sm text-slate-400">Sem materiais planeados.</p>
          )}
        </div>
        <form action={adicionarMaterialPlaneado} className="flex gap-2">
          <input type="hidden" name="service_id" value={servico.id} />
          <input name="nome" placeholder="Material" required className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="qtd" type="number" step="0.01" defaultValue="1" className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-md bg-indigo-900 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-800">
            Adicionar
          </button>
        </form>
      </div>

      {(eventos ?? []).length > 0 && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Histórico</h2>
          <div className="space-y-2">
            {(eventos ?? []).map((e: any, i: number) => (
              <div key={i} className="rounded-md border border-slate-100 p-3 text-sm">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{EVENTO_LABEL[e.tipo] ?? e.tipo}</span>
                  <span>{new Date(e.created_at).toLocaleString("pt-PT")} · {e.profiles?.nome ?? "—"}</span>
                </div>
                <p className="text-slate-700">{e.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(visitas ?? []).length > 0 && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Histórico de visitas</h2>
          <div className="space-y-2">
            {(visitas ?? []).map((v: any) => (
              <div key={v.id} className="rounded-md border border-slate-100 p-3 text-sm">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>{v.data}</span>
                  <span>{v.resultado ?? "em curso"}</span>
                </div>
                {v.trabalho_realizado && <p className="text-slate-700">{v.trabalho_realizado}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(validacoes ?? []).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Histórico de validações</h2>
          <div className="space-y-2">
            {(validacoes ?? []).map((v: any, i: number) => (
              <div
                key={i}
                className={`rounded-md border p-3 text-sm ${
                  v.acao === "validado" ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"
                }`}
              >
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span className="font-semibold">{v.acao === "validado" ? "Validado" : "Rejeitado"}</span>
                  <span>{new Date(v.created_at).toLocaleString("pt-PT")} · {v.profiles?.nome}</span>
                </div>
                {v.motivo && <p className="text-slate-700">{v.motivo}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
