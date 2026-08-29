"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ESTADO_COLOR } from "../servicos/estados";
import { toISO, addDays, monthGridRange, DIAS_SEMANA } from "@/lib/agenda-dates";
import { PREPARACAO_BADGE, type NivelPreparacao } from "@/lib/preparacao";
import { ServicoModal, type ServicoAgenda } from "./ServicoModal";

const HORA_INICIO_GRELHA = 7;
const HORA_FIM_GRELHA = 20;
const ALTURA_HORA = 48; // px

type Servico = ServicoAgenda & { preparacaoNivel?: NivelPreparacao };
type Pessoa = { id: string; nome: string };
type Morada = { id: string; label: string; endereco: string };
type Cliente = { id: string; nome: string; client_addresses: Morada[] };
type PedidoOpcao = { id: string; tipo: string; descricao: string; client_id: string; clients: { nome: string } | null };
type ServicoOpcao = { id: string; tipo: string; descricao: string; client_id: string; clients: { nome: string } | null };

function minutosDoDia(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function AgendaClient({
  view,
  refDateIso,
  dias: diasIso,
  servicosPorDiaEntries,
  clientes,
  tecnicos,
  pedidosAbertos,
  servicosPendentes,
}: {
  view: "dia" | "semana" | "mes";
  refDateIso: string;
  dias: string[];
  servicosPorDiaEntries: [string, Servico[]][];
  clientes: Cliente[];
  tecnicos: Pessoa[];
  pedidosAbertos: PedidoOpcao[];
  servicosPendentes: ServicoOpcao[];
}) {
  const router = useRouter();
  const servicosPorDia = new Map(servicosPorDiaEntries);
  const refDate = new Date(refDateIso + "T00:00:00");
  const dias = diasIso.map((iso) => new Date(iso + "T00:00:00"));

  const [modal, setModal] = useState<
    | { mode: "ver"; servico: Servico }
    | { mode: "criar"; slot: { data: string; horaInicio: string; horaFim: string } }
    | null
  >(null);

  const fecharModal = () => setModal(null);
  const salvarEFechar = () => {
    setModal(null);
    router.refresh();
  };

  const abrirCriar = (data: string, horaInicio: string, horaFim: string) =>
    setModal({ mode: "criar", slot: { data, horaInicio, horaFim } });

  // Botão sempre visível — não depende de clicar numa slot vazia do
  // calendário (isso continua a funcionar, mas deixa de ser o único
  // caminho). Pré-preenche com a próxima hora certa a partir de agora,
  // só para dar um ponto de partida sensato; o Admin muda à vontade.
  const abrirCriarAgora = () => {
    const agora = new Date();
    const inicio = new Date(agora);
    inicio.setMinutes(0, 0, 0);
    if (agora.getMinutes() > 0) inicio.setHours(inicio.getHours() + 1);
    const fim = new Date(inicio);
    fim.setHours(fim.getHours() + 1);
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    abrirCriar(toISO(agora), hhmm(inicio), hhmm(fim));
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={abrirCriarAgora}
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          + Novo Agendamento
        </button>
      </div>

      {view === "mes" ? (
        <CalendarioMes refDate={refDate} servicosPorDia={servicosPorDia} onAbrirServico={(s) => setModal({ mode: "ver", servico: s })} onAbrirSlotVazia={abrirCriar} />
      ) : (
        <GrelhaHoraria dias={dias} servicosPorDia={servicosPorDia} onAbrirServico={(s) => setModal({ mode: "ver", servico: s })} onAbrirSlotVazia={abrirCriar} />
      )}

      {modal && (
        <ServicoModal
          mode={modal.mode}
          servico={modal.mode === "ver" ? modal.servico : null}
          slot={modal.mode === "criar" ? modal.slot : null}
          clientes={clientes}
          tecnicos={tecnicos}
          pedidosAbertos={pedidosAbertos}
          servicosPendentes={servicosPendentes}
          onClose={fecharModal}
          onSaved={salvarEFechar}
        />
      )}
    </>
  );
}

function EventoResumo({ s, onClick }: { s: Servico; onClick: () => void }) {
  const tecnicos = s.service_technicians.map((t) => t.profiles?.nome).filter(Boolean).join(", ");
  const emoji = s.preparacaoNivel ? PREPARACAO_BADGE[s.preparacaoNivel].emoji : null;
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded border-l-4 border-current px-1.5 py-1 text-left text-[11px] leading-tight ${ESTADO_COLOR[s.estado] ?? "bg-neutral-800 text-neutral-300"}`}
    >
      <div className="font-semibold">
        {emoji && <span className="mr-0.5">{emoji}</span>}
        {s.hora_agendada?.slice(0, 5)}
        {s.hora_fim_agendada ? `–${s.hora_fim_agendada.slice(0, 5)}` : ""} · {s.clients?.nome}
      </div>
      <div className="truncate opacity-80">{s.tipo}{tecnicos ? ` · ${tecnicos}` : ""}</div>
    </button>
  );
}

function GrelhaHoraria({
  dias,
  servicosPorDia,
  onAbrirServico,
  onAbrirSlotVazia,
}: {
  dias: Date[];
  servicosPorDia: Map<string, Servico[]>;
  onAbrirServico: (s: Servico) => void;
  onAbrirSlotVazia: (data: string, horaInicio: string, horaFim: string) => void;
}) {
  const horas = Array.from({ length: HORA_FIM_GRELHA - HORA_INICIO_GRELHA }, (_, i) => HORA_INICIO_GRELHA + i);
  const alturaTotal = horas.length * ALTURA_HORA;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="flex min-w-[600px]">
        <div className="w-14 shrink-0 border-r border-neutral-800 pt-8">
          {horas.map((h) => (
            <div key={h} style={{ height: ALTURA_HORA }} className="border-t border-neutral-800 pl-1 text-[10px] text-neutral-500">
              {h}:00
            </div>
          ))}
        </div>
        {dias.map((dia) => {
          const iso = toISO(dia);
          const servicos = (servicosPorDia.get(iso) ?? []).filter((s) => s.hora_agendada);
          const hoje = iso === toISO(new Date());
          return (
            <div key={iso} className="flex-1 border-r border-neutral-800 last:border-r-0">
              <div className={`sticky top-0 border-b border-neutral-800 px-1 py-1.5 text-center text-xs ${hoje ? "bg-neutral-800 font-bold text-neutral-200" : "text-neutral-400"}`}>
                {DIAS_SEMANA[dia.getDay() === 0 ? 6 : dia.getDay() - 1]} {dia.getDate()}
              </div>
              <div className="relative" style={{ height: alturaTotal }}>
                {horas.map((h) => (
                  <button
                    key={h}
                    onClick={() => onAbrirSlotVazia(iso, `${String(h).padStart(2, "0")}:00`, `${String(h + 1).padStart(2, "0")}:00`)}
                    style={{ height: ALTURA_HORA }}
                    className="block w-full border-t border-neutral-900 hover:bg-neutral-800/60"
                    title="Novo agendamento"
                  />
                ))}
                {servicos.map((s) => {
                  const inicio = Math.max(minutosDoDia(s.hora_agendada!), HORA_INICIO_GRELHA * 60);
                  const fimBruto = s.hora_fim_agendada ? minutosDoDia(s.hora_fim_agendada) : inicio + 60;
                  const fim = Math.min(Math.max(fimBruto, inicio + 20), HORA_FIM_GRELHA * 60);
                  const top = ((inicio - HORA_INICIO_GRELHA * 60) / 60) * ALTURA_HORA;
                  const altura = ((fim - inicio) / 60) * ALTURA_HORA;
                  return (
                    <div key={s.id} className="absolute left-0.5 right-0.5" style={{ top, height: altura }}>
                      <EventoResumo s={s} onClick={() => onAbrirServico(s)} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarioMes({
  refDate,
  servicosPorDia,
  onAbrirServico,
  onAbrirSlotVazia,
}: {
  refDate: Date;
  servicosPorDia: Map<string, Servico[]>;
  onAbrirServico: (s: Servico) => void;
  onAbrirSlotVazia: (data: string, horaInicio: string, horaFim: string) => void;
}) {
  const { desde, ate } = monthGridRange(refDate);
  const dias: Date[] = [];
  for (let d = desde; d <= ate; d = addDays(d, 1)) dias.push(d);
  const mesAtual = refDate.getMonth();

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-800 text-center text-xs font-semibold text-neutral-400">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const iso = toISO(dia);
            const servicos = (servicosPorDia.get(iso) ?? []).slice().sort((a, b) => (a.hora_agendada ?? "").localeCompare(b.hora_agendada ?? ""));
            const foraDoMes = dia.getMonth() !== mesAtual;
            const hoje = iso === toISO(new Date());
            return (
              <div key={iso} className={`min-h-[92px] border-b border-r border-neutral-800 p-1 ${foraDoMes ? "bg-neutral-900/60" : ""}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`inline-block rounded px-1.5 text-xs ${hoje ? "bg-white font-bold text-neutral-950" : foraDoMes ? "text-neutral-600" : "text-neutral-300"}`}>
                    {dia.getDate()}
                  </span>
                  <button
                    onClick={() => onAbrirSlotVazia(iso, "09:00", "10:00")}
                    className="rounded px-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    title="Novo agendamento"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-0.5">
                  {servicos.slice(0, 3).map((s) => (
                    <EventoResumo key={s.id} s={s} onClick={() => onAbrirServico(s)} />
                  ))}
                  {servicos.length > 3 && <div className="text-[10px] text-neutral-500">+{servicos.length - 3} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
