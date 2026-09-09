"use client";

import { useState } from "react";
import Link from "next/link";
import { aceitarOrcamento, marcarFollowup, recusarOrcamento } from "../orcamentos/actions";
import EstadoBadge from "../EstadoBadge";

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
      <p className="rounded-2xl border border-edge bg-surface p-6 text-center text-muted-foreground">
        Não há orçamentos à espera de follow-up.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      {linhas.map((linha) => {
        const atrasado = estaAtrasado(linha, hoje);
        return (
          <div
            key={linha.id}
            className={`rounded-2xl border bg-surface p-5 ${atrasado ? "border-red-500/30" : "border-edge"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/orcamentos/${linha.id}`} className="font-medium text-white hover:underline">
                  {linha.numero}
                </Link>
                <span className="ml-2 align-middle">
                  <EstadoBadge estado={linha.estado} />
                </span>
                <div className="mt-1 text-sm text-muted">
                  {linha.clienteNome}
                  {linha.clienteEmpresa ? ` — ${linha.clienteEmpresa}` : ""}
                  {linha.clienteTelefone ? ` · ${linha.clienteTelefone}` : ""}
                </div>
                <div className="mt-1 text-xs">
                  {linha.followupEm ? (
                    <span className={atrasado ? "font-medium text-red-400" : "text-muted-foreground"}>
                      Follow-up: {linha.followupEm} {atrasado && "(atrasado)"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Sem follow-up marcado</span>
                  )}
                </div>
              </div>
              <div className="text-right text-sm font-medium text-white">{linha.total.toFixed(2)} €</div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={novaData[linha.id] ?? linha.followupEm ?? ""}
                onChange={(e) => setNovaData((prev) => ({ ...prev, [linha.id]: e.target.value }))}
                className="rounded-md border border-edge bg-surface-raised px-2 py-1.5 text-sm text-white focus:border-edge-subtle focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onMarcarFollowup(linha.id)}
                className="rounded-md border border-edge-subtle px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
              >
                Marcar follow-up
              </button>
              <button
                type="button"
                onClick={() => onAceitar(linha.id)}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Aceite
              </button>
              <button
                type="button"
                onClick={() => onRecusar(linha.id)}
                className="rounded-md border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
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
