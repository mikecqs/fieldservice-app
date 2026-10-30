"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Search, X } from "lucide-react";
import type { GrupoPedido } from "@/lib/pedido-estado";
import { rotuloTipoServico, TIPO_VISITA_ORCAMENTO } from "@/lib/servico-estado";
import { toISO } from "@/lib/agenda-dates";
import { ESTADO_LABEL as ORC_LABEL, ESTADO_COLOR as ORC_COLOR, ESTADO_COLOR_FALLBACK } from "@/lib/orcamento-visual";
import { Badge } from "@/components/ui/Badge";
import { PedidoDetalheConteudo } from "@/components/pedidos/PedidoDetalheConteudo";
import { usePedidoDetalhe } from "@/components/pedidos/usePedidoDetalhe";

export type ServicoResumo = {
  id: string;
  estado: string;
  tipo: string;
  data: string | null;
  hora: string | null;
  tecnicos: string[];
};

export type LinhaOperacao = {
  chave: string;
  pedidoId: string | null;
  codigo: string | null;
  cliente: string;
  tipo: string;
  descricao: string | null;
  infoFalta: boolean;
  criadoEm: string | null;
  orcamento: { id: string; estado: string } | null;
  servicos: ServicoResumo[];
  estado: { label: string; cls: string; grupo: GrupoPedido; data: string | null };
};

const GRUPOS: { id: GrupoPedido; titulo: string }[] = [
  { id: "acao", titulo: "Precisam de ação" },
  { id: "andamento", titulo: "Em andamento" },
  { id: "concluido", titulo: "Concluídos" },
];

const dataCurta = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null);

export function OperacoesPipeline({ linhas }: { linhas: LinhaOperacao[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<GrupoPedido | "todos">("todos");
  const [abertos, setAbertos] = useState<Record<GrupoPedido, boolean>>({ acao: true, andamento: true, concluido: false });
  const [selecionada, setSelecionada] = useState<LinhaOperacao | null>(null);
  // "Hoje" calculado no browser (hora local do utilizador), nunca no
  // servidor da Vercel, que corre em UTC.
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(toISO(new Date())), []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((l) =>
      [l.codigo, l.cliente, l.tipo, l.descricao, l.estado.label, ...l.servicos.flatMap((s) => s.tecnicos)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [linhas, busca]);

  const porGrupo = useMemo(() => {
    const m: Record<GrupoPedido, LinhaOperacao[]> = { acao: [], andamento: [], concluido: [] };
    for (const l of filtradas) m[l.estado.grupo].push(l);
    return m;
  }, [filtradas]);

  const servicosHoje = hoje ? linhas.flatMap((l) => l.servicos).filter((s) => s.data === hoje).length : null;

  return (
    <div>
      {/* Resumo: cada número é também o filtro */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRUPOS.map((g) => (
          <button
            key={g.id}
            onClick={() => setFiltro(filtro === g.id ? "todos" : g.id)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              filtro === g.id ? "border-white/40 bg-surface-raised" : "border-edge bg-surface hover:bg-surface-raised"
            }`}
          >
            <div className={`text-2xl font-semibold ${g.id === "acao" && porGrupo.acao.length > 0 ? "text-amber-400" : "text-white"}`}>
              {porGrupo[g.id].length}
            </div>
            <div className="text-xs text-muted">{g.titulo}</div>
          </button>
        ))}
        <div className="rounded-xl border border-edge bg-surface px-4 py-3">
          <div className="text-2xl font-semibold text-white">{servicosHoje ?? "—"}</div>
          <div className="text-xs text-muted">Serviços hoje</div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar cliente, código, tipo, estado ou técnico…"
          className="w-full rounded-lg border border-edge bg-surface py-2.5 pl-9 pr-3 text-sm text-neutral-100 placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
        />
      </div>

      {linhas.length === 0 && (
        <p className="py-16 text-center text-sm text-muted">
          Ainda não há trabalho registado.{" "}
          <Link href="/admin/pedidos/novo" className="text-white underline">
            Criar o primeiro pedido →
          </Link>
        </p>
      )}
      {linhas.length > 0 && filtradas.length === 0 && (
        <p className="py-16 text-center text-sm text-muted">Nada corresponde à pesquisa.</p>
      )}

      <div className="space-y-6">
        {GRUPOS.filter((g) => filtro === "todos" || filtro === g.id).map((g) =>
          porGrupo[g.id].length === 0 ? null : (
            <section key={g.id}>
              <button
                onClick={() => setAbertos((a) => ({ ...a, [g.id]: !a[g.id] }))}
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-muted"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${abertos[g.id] || filtro === g.id ? "rotate-90" : ""}`} aria-hidden="true" />
                {g.titulo} · {porGrupo[g.id].length}
              </button>
              {(abertos[g.id] || filtro === g.id) && (
                <div className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface">
                  {porGrupo[g.id].map((l) => (
                    <Linha key={l.chave} l={l} hoje={hoje} onAbrir={() => setSelecionada(l)} />
                  ))}
                </div>
              )}
            </section>
          )
        )}
      </div>

      {selecionada && <PainelLateral l={selecionada} hoje={hoje} onClose={() => setSelecionada(null)} />}
    </div>
  );
}

function BadgeOrcamento({ estado }: { estado: string }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${ORC_COLOR[estado] ?? ESTADO_COLOR_FALLBACK}`}>{ORC_LABEL[estado] ?? estado}</span>;
}

function InfoServico({ s, hoje }: { s: ServicoResumo; hoje: string | null }) {
  const quando = s.data ? (s.data === hoje ? `Hoje${s.hora ? ` ${s.hora}` : ""}` : `${dataCurta(s.data)}${s.hora ? ` ${s.hora}` : ""}`) : null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge estado={s.estado} />
      {quando && <span className={`text-xs ${s.data === hoje ? "font-medium text-orange-400" : "text-muted"}`}>{quando}</span>}
      {s.tecnicos.length > 0 && <span className="text-xs text-muted-foreground">· {s.tecnicos.join(", ")}</span>}
    </span>
  );
}

function Linha({ l, hoje, onAbrir }: { l: LinhaOperacao; hoje: string | null; onAbrir: () => void }) {
  // O serviço "real" é o que interessa mostrar; a Visita Prévia só quando é o único.
  const servico = l.servicos.find((s) => s.tipo !== TIPO_VISITA_ORCAMENTO) ?? l.servicos[0];
  return (
    <button onClick={onAbrir} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-raised">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-neutral-100">{l.cliente}</span>
          {l.codigo && <span className="font-mono text-[11px] text-muted-foreground">{l.codigo}</span>}
          <span className="text-xs text-muted">{rotuloTipoServico(l.tipo)}</span>
          {l.infoFalta && <Badge tone="attention">Falta info</Badge>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {l.orcamento && <BadgeOrcamento estado={l.orcamento.estado} />}
          {l.orcamento && servico && <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
          {servico && <InfoServico s={servico} hoje={hoje} />}
          {!l.orcamento && !servico && <span className={`rounded px-2 py-0.5 text-xs font-medium ${l.estado.cls}`}>{l.estado.label}</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function PainelLateral({ l, hoje, onClose }: { l: LinhaOperacao; hoje: string | null; onClose: () => void }) {
  const { detalhe, aCarregar, erro } = usePedidoDetalhe(l.pedidoId);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisivel(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Detalhe — ${l.cliente}`}>
      <div className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${visivel ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-edge bg-surface shadow-2xl transition-transform duration-200 ${
          visivel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-edge px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{l.cliente}</div>
            <div className="mt-0.5 text-xs text-muted">
              {[l.codigo, rotuloTipoServico(l.tipo)].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {/* Atalhos para agir — as ações vivem nas páginas existentes */}
        <nav className="flex flex-wrap gap-2 border-b border-edge px-5 py-3">
          {l.pedidoId && <Atalho href={`/admin/pedidos/${l.pedidoId}`} label="pedido" />}
          {l.orcamento && <Atalho href={`/admin/orcamentos/${l.orcamento.id}`} label="orçamento" />}
          {l.servicos.map((s) => (
            <Atalho
              key={s.id}
              href={`/admin/servicos/${s.id}`}
              label={l.servicos.length > 1 ? rotuloTipoServico(s.tipo).toLowerCase() : "serviço"}
            />
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {l.pedidoId ? (
            <>
              {aCarregar && <p className="py-10 text-center text-sm text-muted">A carregar…</p>}
              {erro && <p className="py-10 text-center text-sm text-red-400">{erro}</p>}
              {detalhe && <PedidoDetalheConteudo detalhe={detalhe} />}
            </>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-muted">Criado sem pedido de origem.</p>
              {l.descricao && <p className="text-neutral-200">{l.descricao}</p>}
              {l.orcamento && (
                <div className="flex items-center justify-between rounded-lg border border-edge px-3 py-2">
                  <span className="text-muted">Orçamento</span>
                  <BadgeOrcamento estado={l.orcamento.estado} />
                </div>
              )}
              {l.servicos.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-edge px-3 py-2">
                  <span className="text-muted">{rotuloTipoServico(s.tipo)}</span>
                  <InfoServico s={s} hoje={hoje} />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 rounded-md border border-edge px-2.5 py-1 text-xs font-medium text-neutral-200 hover:border-edge-subtle hover:bg-surface-raised"
    >
      Abrir {label} <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}
