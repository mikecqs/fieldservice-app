"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Circle } from "lucide-react";
import { ESTADO_LABEL, ESTADO_COLOR } from "./estados";
import { PREPARACAO_BADGE, type NivelPreparacao } from "@/lib/preparacao";
import { rotuloTipoServico } from "@/lib/servico-estado";

const ESTADOS_POR_EXECUTAR = ["por_agendar", "agendado", "nova_visita", "correcao_necessaria"];

export type ServicoResumo = {
  id: string;
  tipo: string;
  descricao: string;
  prioridade: string;
  estado: string;
  data_agendada: string | null;
  hora_agendada: string | null;
  clients: { nome: string } | null;
  preparacaoNivel: NivelPreparacao;
  preparacaoMotivos: string[];
};

export function ServicosLista({ servicos }: { servicos: ServicoResumo[] }) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return servicos;
    return servicos.filter((s) => {
      const alvo = [s.clients?.nome, rotuloTipoServico(s.tipo), s.descricao, ESTADO_LABEL[s.estado] ?? s.estado, s.prioridade]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [servicos, busca]);

  return (
    <div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Pesquisar por cliente, tipo, descrição ou estado…"
        className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
      />

      {servicos.length === 0 && <p className="py-10 text-center text-sm text-neutral-500">Ainda sem serviços.</p>}
      {servicos.length > 0 && filtrados.length === 0 && (
        <p className="py-10 text-center text-sm text-neutral-500">Nenhum serviço corresponde à pesquisa.</p>
      )}

      <div className="space-y-2">
        {filtrados.map((s) => {
          const badge = PREPARACAO_BADGE[s.preparacaoNivel];
          const mostrarPreparacao = ESTADOS_POR_EXECUTAR.includes(s.estado);
          return (
            <Link
              key={s.id}
              href={`/admin/servicos/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {mostrarPreparacao && (
                    <span title={s.preparacaoMotivos.join(", ")}>
                      <Circle className={`h-2.5 w-2.5 fill-current ${badge.dotColor}`} aria-hidden="true" />
                    </span>
                  )}
                  <span className="font-medium text-neutral-100">{s.clients?.nome}</span>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">{rotuloTipoServico(s.tipo)}</span>
                  {s.prioridade === "alta" && (
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Alta prioridade</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-neutral-400">{s.descricao}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {s.data_agendada && (
                  <span className="text-xs text-neutral-500">
                    {s.data_agendada} {s.hora_agendada?.slice(0, 5)}
                  </span>
                )}
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[s.estado] ?? ""}`}>
                  {ESTADO_LABEL[s.estado] ?? s.estado}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
