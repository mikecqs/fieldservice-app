"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { aceitarOrcamento } from "../actions";
import { verificarConflitoAgenda } from "../../servicos/actions";

type Tecnico = { id: string; nome: string };

// "Aceite → criar serviço" continua um <form action={aceitarOrcamento}>
// nativo (a Server Action faz redirect() no final — nunca envolver isto
// num try/catch manual, que apanharia o redirect como se fosse um erro,
// mesmo padrão/aviso já documentado em AgendarVisitaPreviaButton.tsx). O
// agendamento é só campos extra no mesmo formulário: a verificação de
// conflito corre à parte (botão próprio, nunca bloqueia o "Aceite"), com o
// mesmo aviso não-bloqueante já usado na Agenda/ficha do Serviço.
export function AceitarOrcamentoForm({ orcamentoId, tecnicos }: { orcamentoId: string; tecnicos: Tecnico[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [agendarAgora, setAgendarAgora] = useState(false);
  const [data, setData] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [aVerificar, setAVerificar] = useState(false);
  const [conflito, setConflito] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);

  async function verificar() {
    if (!data || !horaInicio || !horaFim) return;
    setAVerificar(true);
    setConflito(null);
    try {
      const resultado = await verificarConflitoAgenda({
        technicianIds: tecnicoId ? [tecnicoId] : [],
        data,
        horaInicio,
        horaFim,
      });
      if (resultado.conflito) setConflito(resultado.mensagem);
    } finally {
      setAVerificar(false);
    }
  }

  return (
    <form ref={formRef} action={aceitarOrcamento} onSubmit={() => setSubmetendo(true)} className="space-y-2">
      <input type="hidden" name="id" value={orcamentoId} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAgendarAgora(false)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            !agendarAgora ? "border-white bg-neutral-800 text-neutral-200" : "border-neutral-700 text-neutral-400"
          }`}
        >
          Agendar mais tarde
        </button>
        <button
          type="button"
          onClick={() => setAgendarAgora(true)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            agendarAgora ? "border-white bg-neutral-800 text-neutral-200" : "border-neutral-700 text-neutral-400"
          }`}
        >
          Agendar já
        </button>
      </div>

      {agendarAgora && (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-neutral-800 bg-neutral-950 p-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-neutral-400">Data</span>
            <input
              type="date"
              name="data_agendada"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
                setConflito(null);
              }}
              onBlur={verificar}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-neutral-400">Hora início</span>
              <input
                type="time"
                name="hora_agendada"
                value={horaInicio}
                onChange={(e) => {
                  setHoraInicio(e.target.value);
                  setConflito(null);
                }}
                onBlur={verificar}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-neutral-400">Hora fim</span>
              <input
                type="time"
                name="hora_fim_agendada"
                value={horaFim}
                onChange={(e) => {
                  setHoraFim(e.target.value);
                  setConflito(null);
                }}
                onBlur={verificar}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          {tecnicos.length > 0 && (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-neutral-400">Técnico (opcional)</span>
              <select
                name="tecnico_id"
                value={tecnicoId}
                onChange={(e) => {
                  setTecnicoId(e.target.value);
                  setConflito(null);
                }}
                onBlur={verificar}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
              >
                <option value="">Sem técnico por agora</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {aVerificar && <p className="text-[11px] text-neutral-500 sm:col-span-2">A verificar disponibilidade…</p>}
          {conflito && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-400 sm:col-span-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Conflito de agenda: {conflito}
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submetendo}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submetendo ? "A criar…" : "Aceite → criar serviço"}
      </button>
    </form>
  );
}
