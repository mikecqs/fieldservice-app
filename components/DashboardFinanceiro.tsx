import Link from "next/link";
import { formatDuracao, formatEuros, type FinanceiroRange } from "@/lib/financeiro";

const PRESETS = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

export function DashboardFinanceiro({
  basePath,
  preset,
  range,
  stats,
}: {
  basePath: string;
  preset: string;
  range: FinanceiroRange;
  stats: Awaited<ReturnType<typeof import("@/lib/financeiro").getFinanceiroStats>>;
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Dashboard financeiro</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {range.label} · {range.desde} a {range.ate}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`${basePath}?range=${p.value}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              preset === p.value ? "bg-indigo-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <details className="relative">
          <summary
            className={`list-none cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium ${
              preset === "custom" ? "bg-indigo-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Personalizado
          </summary>
          <form
            method="get"
            className="absolute left-0 z-10 mt-2 flex w-64 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          >
            <input type="hidden" name="range" value="custom" />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">De</span>
              <input type="date" name="desde" defaultValue={range.desde} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Até</span>
              <input type="date" name="ate" defaultValue={range.ate} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
            </label>
            <button className="rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">Aplicar</button>
          </form>
        </details>
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Faturação</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total faturado" value={formatEuros(stats.faturacao.totalFaturado)} />
        <Stat label="Total por faturar" value={formatEuros(stats.faturacao.totalPorFaturar)} />
        <Stat label="Nº serviços faturados" value={String(stats.faturacao.nFaturados)} />
        <Stat label="Valor médio" value={formatEuros(stats.faturacao.valorMedio)} />
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Produção</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Concluídos no período" value={String(stats.producao.concluidos)} />
        <Stat label="Pendentes (agora)" value={String(stats.producao.pendentes)} />
        <Stat label="Serviço mais realizado" value={stats.producao.servicoMaisRealizado ?? "—"} />
        <Stat label="Novas visitas" value={String(stats.producao.novasVisitas)} />
      </div>
      {Object.keys(stats.producao.porTipo).length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-xs font-medium text-slate-500">Concluídos por tipo</div>
          <div className="space-y-1">
            {Object.entries(stats.producao.porTipo).map(([tipo, n]) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{tipo}</span>
                <span className="font-medium text-slate-800">{n as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Tempos médios</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Pedido → conclusão" value={formatDuracao(stats.tempos.pedidoConclusaoHoras)} />
        <Stat label="Agendamento → início" value={formatDuracao(stats.tempos.agendamentoInicioHoras)} />
        <Stat label="Início → conclusão" value={formatDuracao(stats.tempos.inicioConclusaoHoras)} />
      </div>
      {Object.keys(stats.tempos.porTipoHoras).length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-xs font-medium text-slate-500">Tempo médio (início → conclusão) por tipo</div>
          <div className="space-y-1">
            {Object.entries(stats.tempos.porTipoHoras).map(([tipo, h]) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{tipo}</span>
                <span className="font-medium text-slate-800">{formatDuracao(h as number | null)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Valores (orçamentos do período)</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Mão de obra" value={formatEuros(stats.valores.mao_obra)} />
        <Stat label="Materiais" value={formatEuros(stats.valores.materiais)} />
        <Stat label="Deslocações" value={formatEuros(stats.valores.deslocacao)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 text-xs font-medium text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900 sm:text-xl">{value}</div>
    </div>
  );
}
