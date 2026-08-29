"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarAgendamento, verificarConflitoAgenda } from "../actions";
import { podeReagendarServico } from "@/lib/servico-estado";

export function AgendamentoForm({ servico }: { servico: any }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [aVerificar, setAVerificar] = useState(false);
  const [conflito, setConflito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Mesma regra do servidor (lib/servico-estado.ts) — nunca uma segunda
  // regra diferente aqui, só para refletir visualmente o que o servidor já
  // vai recusar de qualquer forma.
  if (!podeReagendarServico(servico)) {
    return (
      <div className="rounded-md border border-neutral-800 bg-neutral-800/50 p-3 text-sm text-neutral-400">
        🔒 Este serviço já não pode ser reagendado (
        {servico.faturacao_estado === "faturado" ? "já faturado" : "concluído, cancelado ou não realizado"}
        ). Data: {servico.data_agendada ?? "—"} {servico.hora_agendada?.slice(0, 5) ?? ""}
        {servico.hora_fim_agendada ? `–${servico.hora_fim_agendada.slice(0, 5)}` : ""}
      </div>
    );
  }

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
        <span className="mb-1 block text-xs font-medium text-neutral-300">Data</span>
        <input type="date" name="data_agendada" defaultValue={servico.data_agendada ?? ""} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-300">Hora início</span>
          <input type="time" name="hora_agendada" defaultValue={servico.hora_agendada?.slice(0, 5) ?? ""} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-300">Hora fim</span>
          <input type="time" name="hora_fim_agendada" defaultValue={servico.hora_fim_agendada?.slice(0, 5) ?? ""} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Prioridade</span>
        <select name="prioridade" defaultValue={servico.prioridade} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
          <option value="baixa">Baixa</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
        </select>
      </label>
      <label className="col-span-2 block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Notas</span>
        <textarea name="notas" defaultValue={servico.notas ?? ""} rows={2} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>

      {conflito && (
        <div className="col-span-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          <p className="mb-2">⚠️ Conflito de agenda: {conflito}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConflito(null)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
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
      {erro && <p className="col-span-2 text-sm text-red-400">{erro}</p>}

      <button
        disabled={aVerificar}
        className="col-span-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
      >
        {aVerificar ? "A verificar…" : "Guardar agendamento"}
      </button>
    </form>
  );
}
