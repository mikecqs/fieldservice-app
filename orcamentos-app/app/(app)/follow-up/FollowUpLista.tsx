"use client";

import { useState } from "react";
import Link from "next/link";
import { ROTULOS_ESTADO, type EstadoOrcamento } from "@/lib/orcamento-estado";
import { aceitarOrcamento, marcarFollowup, recusarOrcamento } from "../orcamentos/actions";

export type FollowUpLinha = {
  id: string;
  numero: string;
  estado: string;
  criadoEm: string;
  followupEm: string | null;
  total: number;
  clienteNome: string;
  clienteEmpresa: string;
  clienteTelefone: string;
};

function estaAtrasado(linha: FollowUpLinha, hoje: string): boolean {
  return !!linha.followupEm && linha.followupEm < hoje;
}

export default function FollowUpLista({ linhas }: { linhas: FollowUpLinha[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [novaData, setNovaData] = useState<Record<string, string>>({});
  const hoje = new Date().toISOString().slice(0, 10);

  async function onMarcarFollowup(budgetId: string) {
    setErro(null);
    const data = novaData[budgetId];
    if (!data) {
      setErro("Escolha uma data para o follow-up.");
      return;
    }
    const formData = new FormData();
    formData.set("followupEm", data);
    const resultado = await marcarFollowup(budgetId, formData);
    if (resultado?.erro) setErro(resultado.erro);
  }

  async function onAceitar(budgetId: string) {
    setErro(null);
    const resultado = await aceitarOrcamento(budgetId);
    if (resultado?.erro) setErro(resultado.erro);
  }

  async function onRecusar(budgetId: string) {
    setErro(null);
    const resultado = await recusarOrcamento(budgetId);
    if (resultado?.erro) setErro(resultado.erro);
  }

  if (linhas.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">
        Não há orçamentos à espera de follow-up.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {linhas.map((linha) => {
        const atrasado = estaAtrasado(linha, hoje);
        return (
          <div
            key={linha.id}
            className={`rounded-xl border bg-white p-4 ${atrasado ? "border-red-300" : "border-slate-200"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/orcamentos/${linha.id}`} className="font-medium text-brand-600 hover:underline">
                  {linha.numero}
                </Link>
                <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {ROTULOS_ESTADO[linha.estado as EstadoOrcamento] ?? linha.estado}
                </span>
                <div className="mt-1 text-sm text-slate-600">
                  {linha.clienteNome}
                  {linha.clienteEmpresa ? ` — ${linha.clienteEmpresa}` : ""}
                  {linha.clienteTelefone ? ` · ${linha.clienteTelefone}` : ""}
                </div>
                <div className="mt-1 text-xs">
                  {linha.followupEm ? (
                    <span className={atrasado ? "font-medium text-red-600" : "text-slate-500"}>
                      Follow-up: {linha.followupEm} {atrasado && "(atrasado)"}
                    </span>
                  ) : (
                    <span className="text-slate-400">Sem follow-up marcado</span>
                  )}
                </div>
              </div>
              <div className="text-right text-sm font-medium text-slate-800">{linha.total.toFixed(2)} €</div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={novaData[linha.id] ?? linha.followupEm ?? ""}
                onChange={(e) => setNovaData((prev) => ({ ...prev, [linha.id]: e.target.value }))}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onMarcarFollowup(linha.id)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Marcar follow-up
              </button>
              <button
                type="button"
                onClick={() => onAceitar(linha.id)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Aceite
              </button>
              <button
                type="button"
                onClick={() => onRecusar(linha.id)}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Recusado
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
