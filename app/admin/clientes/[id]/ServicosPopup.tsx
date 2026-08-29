"use client";

import { useState } from "react";
import Link from "next/link";
import { ESTADO_LABEL, ESTADO_COLOR } from "@/app/admin/servicos/estados";

type ServicoResumo = { id: string; codigo: string; tipo: string; descricao: string; estado: string; data_agendada: string | null };

// Substitui a antiga lista de texto corrido "Serviços" na ficha do cliente:
// o cartão "Serviços" passa a ser um botão que abre este popup (mesmo
// padrão visual/estrutural do PedidoModal/ServicoModal já usados em
// Pedidos/Agenda). Os serviços já vêm carregados pela própria página do
// cliente — não há nenhuma query nova aqui, só a apresentação.
export function ServicosPopup({ servicos }: { servicos: ServicoResumo[] }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left hover:border-neutral-600"
      >
        <div className="mb-2 text-xs font-medium text-neutral-400">Serviços</div>
        <div className="text-2xl font-bold text-white">{servicos.length}</div>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-base font-bold text-white">Serviços · {servicos.length}</h2>
              <button onClick={() => setAberto(false)} className="rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800">
                Fechar ✕
              </button>
            </div>

            <div className="space-y-1.5">
              {servicos.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/servicos/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 p-2.5 text-sm hover:bg-neutral-800"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">{s.codigo}</span>
                      <span className="truncate font-medium text-neutral-100">{s.tipo}</span>
                    </div>
                    <div className="truncate text-xs text-neutral-500">{s.descricao}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-neutral-400">{s.data_agendada ?? "sem data"}</div>
                    <span
                      className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        ESTADO_COLOR[s.estado] ?? "bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      {ESTADO_LABEL[s.estado] ?? s.estado}
                    </span>
                  </div>
                </Link>
              ))}
              {servicos.length === 0 && <p className="py-8 text-center text-sm text-neutral-500">Ainda sem serviços.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
