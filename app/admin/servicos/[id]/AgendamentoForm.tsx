"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarAgendamento, verificarConflitoAgenda } from "../actions";

export function AgendamentoForm({ servico }: { servico: any }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [aVerificar, setAVerificar] = useState(false);
  const [conflito, setConflito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar(formData: FormData) {
    setErro(null);
    try {
      await atualizarAgendamento(formData);
      setConflito(null);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = String(formData.get("data_agendada") || "");
    const horaInicio = String(formData.get("hora_agendada") || "");
    const horaFim = String(formData.get("hora_fim_agendada") || "");

    if (!data || !horaInicio || !horaFim) {
      await gravar(formData);
      return;
    }

    setAVerificar(true);
    try {
      const resultado = await verificarConflitoAgenda({ serviceId: servico.id, data, horaInicio, horaFim });
      if (resultado.conflito) {
        setConflito(resultado.mensagem);
      } else {
        await gravar(formData);
      }
    } finally {
      setAVerificar(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={servico.id} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Data</span>
        <input type="date" name="data_agendada" defaultValue={servico.data_agendada ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Hora início</span>
          <input type="time" name="hora_agendada" defaultValue={servico.hora_agendada?.slice(0, 5) ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Hora fim</span>
          <input type="time" name="hora_fim_agendada" defaultValue={servico.hora_fim_agendada?.slice(0, 5) ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Prioridade</span>
        <select name="prioridade" defaultValue={servico.prioridade} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="baixa">Baixa</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
        </select>
      </label>
      <label className="col-span-2 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Notas</span>
        <textarea name="notas" defaultValue={servico.notas ?? ""} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>

      {conflito && (
        <div className="col-span-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-2">⚠️ Conflito de agenda: {conflito}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConflito(null)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => formRef.current && gravar(new FormData(formRef.current))}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Agendar na mesma
            </button>
          </div>
        </div>
      )}
      {erro && <p className="col-span-2 text-sm text-red-600">{erro}</p>}

      <button
        disabled={aVerificar}
        className="col-span-2 rounded-md bg-indigo-900 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
      >
        {aVerificar ? "A verificar…" : "Guardar agendamento"}
      </button>
    </form>
  );
}
