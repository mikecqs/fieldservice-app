import Link from "next/link";
import { AlertTriangle, Timer, TrendingUp, Users, Wrench, ClipboardList, Euro, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeRange, getFinanceiroStats, formatDuracao, formatEuros } from "@/lib/financeiro";
import { getPontosAtencao, getEvolucao, getTecnicos, getTiposServico, getOrcamentosFunil, getMateriais, getAgenda } from "@/lib/relatorios";
import { EvolucaoChart } from "@/components/relatorios/EvolucaoChart";
import { TiposServicoChart } from "@/components/relatorios/TiposServicoChart";
import { OrcamentosDonut } from "@/components/relatorios/OrcamentosDonut";
import { TabelaServicos, type ServicoLinha } from "@/components/relatorios/TabelaServicos";
import { ExportarRelatoriosExcel } from "@/components/relatorios/ExportarRelatoriosExcel";
import { rotuloTipoServico } from "@/lib/servico-estado";

const PRESETS = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

function periodoAnterior(desde: string, ate: string) {
  const d1 = new Date(desde);
  const d2 = new Date(ate);
  const duracaoDias = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86_400_000) + 1);
  const anteAte = new Date(d1.getTime() - 86_400_000);
  const anteDesde = new Date(anteAte.getTime() - (duracaoDias - 1) * 86_400_000);
  return { desde: anteDesde.toISOString().slice(0, 10), ate: anteAte.toISOString().slice(0, 10) };
}

function Variacao({ atual, anterior }: { atual: number; anterior: number | null }) {
  if (anterior === null || anterior === 0) return null;
  const delta = ((atual - anterior) / anterior) * 100;
  if (!isFinite(delta) || Math.abs(delta) < 0.5) return <span className="text-xs text-neutral-500">≈ igual ao período anterior</span>;
  const positivo = delta > 0;
  return (
    <span className={`text-xs font-medium ${positivo ? "text-emerald-400" : "text-red-400"}`}>
      {positivo ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}% vs. período anterior
    </span>
  );
}

function Cartao({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-700">
      <div className="mb-2 text-xs font-medium text-neutral-400">{label}</div>
      <div className="mb-1 text-2xl font-bold text-white sm:text-[28px]">{value}</div>
      {sub}
    </div>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { range?: string; desde?: string; ate?: string };
}) {
  const supabase = createClient();
  const preset = searchParams.range ?? "mes";
  const range = computeRange(preset, searchParams.desde, searchParams.ate);
  const anterior = periodoAnterior(range.desde, range.ate);

  const [stats, statsAnterior, pontosAtencao, evolucao, tecnicos, tiposServico, orcamentos, materiais, agenda] = await Promise.all([
    getFinanceiroStats(supabase, range.desde, range.ate),
    getFinanceiroStats(supabase, anterior.desde, anterior.ate),
    getPontosAtencao(supabase),
    getEvolucao(supabase, range.desde, range.ate),
    getTecnicos(supabase, range.desde, range.ate),
    getTiposServico(supabase, range.desde, range.ate),
    getOrcamentosFunil(supabase, range.desde, range.ate),
    getMateriais(supabase, range.desde, range.ate),
    getAgenda(supabase, range.desde, range.ate),
  ]);

  const { data: servicosLinhas } = await supabase
    .from("services")
    .select("id, tipo, estado, data_agendada, valor, faturacao_estado, clients(nome)")
    .gte("data_agendada", range.desde)
    .lte("data_agendada", range.ate)
    .order("data_agendada", { ascending: false });

  const linhas: ServicoLinha[] = (servicosLinhas ?? []).map((s: any) => ({
    id: s.id,
    cliente: s.clients?.nome ?? "—",
    tipo: rotuloTipoServico(s.tipo),
    estado: s.estado,
    data_agendada: s.data_agendada,
    valor: Number(s.valor ?? 0),
    faturacao_estado: s.faturacao_estado,
  }));

  const linkRange = (v: string) => `/admin/relatorios?range=${v}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Relatórios</h1>
          <p className="mt-0.5 text-sm text-neutral-400">Análise operacional, financeira e de desempenho</p>
        </div>
        <ExportarRelatoriosExcel
          range={range}
          stats={stats}
          tecnicos={tecnicos}
          tiposServico={tiposServico}
          orcamentos={orcamentos}
          materiais={materiais}
          agenda={agenda}
          linhas={linhas}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.value}
            href={linkRange(p.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${preset === p.value ? "bg-white text-neutral-950" : "border border-neutral-700 text-neutral-200 hover:bg-neutral-800"}`}
          >
            {p.label}
          </Link>
        ))}
        <details className="relative">
          <summary
            className={`list-none cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium ${preset === "custom" ? "bg-white text-neutral-950" : "border border-neutral-700 text-neutral-200 hover:bg-neutral-800"}`}
          >
            Personalizado
          </summary>
          <form method="get" className="absolute left-0 z-10 mt-2 flex w-64 flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-lg">
            <input type="hidden" name="range" value="custom" />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">De</span>
              <input type="date" name="desde" defaultValue={range.desde} className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Até</span>
              <input type="date" name="ate" defaultValue={range.ate} className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs" />
            </label>
            <button className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200">Aplicar</button>
          </form>
        </details>
        <span className="text-xs text-neutral-500">{range.label} · {range.desde} a {range.ate}</span>
      </div>

      {/* 6 cartões principais */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Cartao label="Serviços concluídos" value={String(stats.producao.concluidos)} sub={<Variacao atual={stats.producao.concluidos} anterior={statsAnterior.producao.concluidos} />} />
        <Cartao label="Faturado" value={formatEuros(stats.faturacao.totalFaturado)} sub={<Variacao atual={stats.faturacao.totalFaturado} anterior={statsAnterior.faturacao.totalFaturado} />} />
        <Cartao label="Por faturar" value={formatEuros(stats.faturacao.totalPorFaturar)} />
        <Cartao label="Tempo médio (início → fecho)" value={formatDuracao(stats.tempos.inicioConclusaoHoras)} />
        <Cartao
          label="Orçamentos"
          value={String(orcamentos.criados)}
          sub={<span className="text-xs text-neutral-500">Taxa de aceitação: {orcamentos.taxaAceitacao !== null ? `${orcamentos.taxaAceitacao.toFixed(0)}%` : "—"}</span>}
        />
        <Cartao label="Novas visitas" value={String(stats.producao.novasVisitas)} sub={<Variacao atual={stats.producao.novasVisitas} anterior={statsAnterior.producao.novasVisitas} />} />
      </div>

      {/* Pontos de atenção */}
      <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-400">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Pontos de atenção
          </h2>
          <Link href="/admin/dashboard" className="text-xs text-neutral-400 underline hover:text-neutral-200">Ver Dashboard →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><div className="text-lg font-bold text-white">{pontosAtencao.atrasados}</div><div className="text-xs text-neutral-400">Serviços atrasados</div></div>
          <div><div className="text-lg font-bold text-white">{pontosAtencao.orcamentosSemResposta}</div><div className="text-xs text-neutral-400">Orçamentos sem resposta</div></div>
          <div><div className="text-lg font-bold text-white">{pontosAtencao.fechadosSemFaturar}</div><div className="text-xs text-neutral-400">Fechados sem faturar</div></div>
          <div><div className="text-lg font-bold text-white">{pontosAtencao.novaVisita}</div><div className="text-xs text-neutral-400">Novas visitas por agendar</div></div>
        </div>
      </div>

      {/* Onde estamos a perder tempo */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
          <Timer className="h-4 w-4" aria-hidden="true" /> Onde estamos a perder tempo?
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div><div className="text-base font-bold text-white">{formatDuracao(stats.tempos.pedidoAgendamentoHoras)}</div><div className="text-xs text-neutral-400">Pedido → Agendamento</div></div>
          <div><div className="text-base font-bold text-white">{formatDuracao(stats.tempos.agendamentoInicioHoras)}</div><div className="text-xs text-neutral-400">Agendamento → Início</div></div>
          <div><div className="text-base font-bold text-white">{formatDuracao(stats.tempos.inicioConclusaoHoras)}</div><div className="text-xs text-neutral-400">Início → Fecho</div></div>
          <div><div className="text-base font-bold text-white">{formatDuracao(stats.tempos.validacaoFaturacaoHoras)}</div><div className="text-xs text-neutral-400">Fecho → Faturação</div></div>
          <div className="border-l border-neutral-800 pl-3"><div className="text-base font-bold text-white">{formatDuracao(stats.tempos.pedidoFaturacaoHoras)}</div><div className="text-xs text-neutral-400">Total (pedido → faturação)</div></div>
        </div>
      </div>

      {/* Evolução */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
          <TrendingUp className="h-4 w-4" aria-hidden="true" /> Evolução
        </h2>
        <EvolucaoChart dados={evolucao} />
      </div>

      {/* Técnicos */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
          <Users className="h-4 w-4" aria-hidden="true" /> Técnicos
        </h2>
        {tecnicos.length === 0 ? (
          <p className="text-sm text-neutral-500">Sem dados no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="pb-2 pr-3 font-medium">Técnico</th>
                  <th className="pb-2 pr-3 font-medium">Serviços</th>
                  <th className="pb-2 pr-3 font-medium">Horas</th>
                  <th className="pb-2 pr-3 font-medium">Tempo médio</th>
                  <th className="pb-2 font-medium">Novas visitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {tecnicos.map((t) => (
                  <tr key={t.nome}>
                    <td className="py-2 pr-3 text-neutral-200">{t.nome}</td>
                    <td className="py-2 pr-3 text-neutral-300">{t.concluidos}</td>
                    <td className="py-2 pr-3 text-neutral-300">{t.horas}h</td>
                    <td className="py-2 pr-3 text-neutral-300">{formatDuracao(t.tempoMedioHoras)}</td>
                    <td className="py-2 text-neutral-300">{t.novasVisitas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tipos de serviço */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
          <Wrench className="h-4 w-4" aria-hidden="true" /> Tipos de serviço
        </h2>
        {tiposServico.length === 0 ? (
          <p className="text-sm text-neutral-500">Sem dados no período.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <TiposServicoChart dados={tiposServico} />
            <div className="space-y-2">
              {tiposServico.map((t) => (
                <div key={t.tipo} className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-sm">
                  <span className="text-neutral-200">{t.tipo}</span>
                  <span className="text-xs text-neutral-400">
                    {t.quantidade} · {formatDuracao(t.tempoMedioHoras)} · {t.valorMedio !== null ? formatEuros(t.valorMedio) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orçamentos */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Orçamentos
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <OrcamentosDonut aceites={orcamentos.aceites} recusados={orcamentos.recusados} pendentes={orcamentos.pendentes} />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="font-bold text-white">{orcamentos.criados}</div><div className="text-xs text-neutral-400">Criados</div></div>
            <div><div className="font-bold text-white">{orcamentos.enviados}</div><div className="text-xs text-neutral-400">Enviados</div></div>
            <div><div className="font-bold text-white">{formatEuros(orcamentos.valorTotal)}</div><div className="text-xs text-neutral-400">Valor total</div></div>
            <div><div className="font-bold text-white">{formatEuros(orcamentos.valorAceite)}</div><div className="text-xs text-neutral-400">Valor aceite</div></div>
            <div><div className="font-bold text-white">{formatDuracao(orcamentos.tempoMedioRespostaHoras)}</div><div className="text-xs text-neutral-400">Tempo até resposta</div></div>
            <div><div className="font-bold text-white">{orcamentos.followupsPendentes}</div><div className="text-xs text-neutral-400">Follow-ups pendentes</div></div>
          </div>
        </div>
      </div>

      {/* Financeiro */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
          <Euro className="h-4 w-4" aria-hidden="true" /> Financeiro
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><div className="font-bold text-white">{formatEuros(stats.faturacao.totalFaturado)}</div><div className="text-xs text-neutral-400">Faturado</div></div>
          <div><div className="font-bold text-white">{formatEuros(stats.faturacao.totalPorFaturar)}</div><div className="text-xs text-neutral-400">Por faturar</div></div>
          <div><div className="font-bold text-white">{formatEuros(stats.valores.mao_obra)}</div><div className="text-xs text-neutral-400">Mão de obra</div></div>
          <div><div className="font-bold text-white">{formatEuros(stats.valores.materiais)}</div><div className="text-xs text-neutral-400">Materiais</div></div>
        </div>
      </div>

      {/* Materiais */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
          <Package className="h-4 w-4" aria-hidden="true" /> Materiais
        </h2>
        {materiais.length === 0 ? (
          <p className="text-sm text-neutral-500">Sem materiais utilizados no período.</p>
        ) : (
          <div className="space-y-1.5">
            {materiais.slice(0, 10).map((m) => (
              <div key={m.nome} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">{m.nome}</span>
                <span className="text-xs text-neutral-400">
                  {m.qtdUtilizada} {m.qtdPrevista !== null ? `(previsto: ${m.qtdPrevista})` : ""} · {formatEuros(m.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agenda */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-100">📅 Agenda</h2>
        <p className="mb-3 text-xs text-neutral-500">"Horas disponíveis" é uma estimativa (nº de técnicos × dias do período × 8h) — a app não tem configuração de turnos/capacidade real.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div><div className="font-bold text-white">{agenda.horasDisponiveis}h</div><div className="text-xs text-neutral-400">Disponíveis (estim.)</div></div>
          <div><div className="font-bold text-white">{agenda.horasAgendadas.toFixed(0)}h</div><div className="text-xs text-neutral-400">Agendadas</div></div>
          <div><div className="font-bold text-white">{agenda.horasTrabalhadas}h</div><div className="text-xs text-neutral-400">Trabalhadas</div></div>
          <div><div className="font-bold text-white">{agenda.taxaOcupacao !== null ? `${agenda.taxaOcupacao.toFixed(0)}%` : "—"}</div><div className="text-xs text-neutral-400">Ocupação</div></div>
          <div><div className="font-bold text-white">{agenda.iniciadosAtrasados}</div><div className="text-xs text-neutral-400">Iniciados atrasados</div></div>
          <div><div className="font-bold text-white">{agenda.reagendamentos}</div><div className="text-xs text-neutral-400">Reagendamentos</div></div>
        </div>
      </div>

      {/* Tabela detalhada */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">🔎 Todos os serviços</h2>
        <TabelaServicos linhas={linhas} />
      </div>
    </div>
  );
}
