"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { reativarServico, verificarConflitoAgenda } from "../actions";

type Tecnico = { id: string; nome: string };

// Único formulário de reativação de um serviço "Não foi possível realizar"
// — reutiliza verificarConflitoAgenda (mesmo aviso não-bloqueante já usado
// em AgendamentoForm/ServicoModal) antes de gravar. A validação que conta
// a sério (estado tem de ser exatamente 'nao_realizado', nunca se já
// faturado) está sempre em reativarServico, no servidor.
export function ReativarServicoForm({ servicoId, tecnicosDisponiveis }: { servicoId: string; tecnicosDisponiveis: Tecnico[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [data, setData] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [conflito, setConflito] = useState<string | null>(null);
  const [confirmouConflito, setConfirmouConflito] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function limparConflito() {
    setConflito(null);
    setConfirmouConflito(false);
  }

  async function gravar(formData: FormData) {
    setErro(null);
    setAGuardar(true);
    try {
      await reativarServico(formData);
      router.refresh();
    } catch (e: any) {
      setErro(e.message || "Não foi possível reativar o serviço.");
    } finally {
      setAGuardar(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!data || !horaInicio || !horaFim) {
      setErro("Data, hora de início e hora de fim são obrigatórias.");
      return;
    }
    if (horaFim <= horaInicio) {
      setErro("A hora de término deve ser depois da hora de início.");
      return;
    }

    if (!confirmouConflito && tecnicoId) {
      const resultado = await verificarConflitoAgenda({
        serviceId: servicoId,
        technicianIds: [tecnicoId],
        data,
        horaInicio,
        horaFim,
      });
      if (resultado.conflito) {
        setConflito(resultado.mensagem);
        return;
      }
    }

    await gravar(formData);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <input type="hidden" name="id" value={servicoId} />
      <p className="text-xs font-medium text-emerald-300">Reativar serviço — nova data e hora</p>

      <div className="grid grid-cols-3 gap-2">
        <input
          type="date"
          name="data_agendada"
          required
          value={data}
          onChange={(e) => {
            setData(e.target.value);
            limparConflito();
          }}
          className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
        />
        <input
          type="time"
          name="hora_agendada"
          required
          value={horaInicio}
          onChange={(e) => {
            setHoraInicio(e.target.value);
            limparConflito();
          }}
          className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
        />
        <input
          type="time"
          name="hora_fim_agendada"
          required
          value={horaFim}
          onChange={(e) => {
            setHoraFim(e.target.value);
            limparConflito();
          }}
          className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
        />
      </div>

      {tecnicosDisponiveis.length > 0 && (
        <select
          name="tecnico_id"
          value={tecnicoId}
          onChange={(e) => {
            setTecnicoId(e.target.value);
            limparConflito();
          }}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
        >
          <option value="">Sem técnico por agora</option>
          {tecnicosDisponiveis.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
      )}

      {conflito && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
          <p className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Conflito de agenda: {conflito}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setConflito(null)} className="flex-1 rounded-md border border-neutral-700 px-2 py-1 text-neutral-200">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmouConflito(true);
                setConflito(null);
                if (formRef.current) gravar(new FormData(formRef.current));
              }}
              className="flex-1 rounded-md bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700"
            >
              Reativar na mesma
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      <button
        disabled={aGuardar}
        className="w-full rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {aGuardar ? "A reativar…" : "Confirmar reativação"}
      </button>
    </form>
  );
}
