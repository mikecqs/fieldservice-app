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
        <h1 className="text-xl font-bold text-white">Dashboard financeiro</h1>
        <p className="mt-0.5 text-sm text-neutral-400">
          {range.label} · {range.desde} a {range.ate}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`${basePath}?range=${p.value}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              preset === p.value ? "bg-white text-neutral-950" : "border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <details className="relative">
          <summary
            className={`list-none cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium ${
              preset === "custom" ? "bg-white text-neutral-950" : "border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            Personalizado
          </summary>
          <form
            method="get"
            className="absolute left-0 z-10 mt-2 flex w-64 flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-lg"
          >
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
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Faturação</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total faturado" value={formatEuros(stats.faturacao.totalFaturado)} />
        <Stat label="Total por faturar" value={formatEuros(stats.faturacao.totalPorFaturar)} />
        <Stat label="Nº serviços faturados" value={String(stats.faturacao.nFaturados)} />
        <Stat label="Valor médio" value={formatEuros(stats.faturacao.valorMedio)} />
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Produção</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Concluídos no período" value={String(stats.producao.concluidos)} />
        <Stat label="Pendentes (agora)" value={String(stats.producao.pendentes)} />
        <Stat label="Serviço mais realizado" value={stats.producao.servicoMaisRealizado ?? "—"} />
        <Stat label="Novas visitas" value={String(stats.producao.novasVisitas)} />
      </div>
      {Object.keys(stats.producao.porTipo).length > 0 && (
        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-2 text-xs font-medium text-neutral-400">Concluídos por tipo</div>
          <div className="space-y-1">
            {Object.entries(stats.producao.porTipo).map(([tipo, n]) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">{tipo}</span>
                <span className="font-medium text-neutral-100">{n as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Tempos médios</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Pedido → conclusão" value={formatDuracao(stats.tempos.pedidoConclusaoHoras)} />
        <Stat label="Agendamento → início" value={formatDuracao(stats.tempos.agendamentoInicioHoras)} />
        <Stat label="Início → conclusão" value={formatDuracao(stats.tempos.inicioConclusaoHoras)} />
      </div>
      {Object.keys(stats.tempos.porTipoHoras).length > 0 && (
        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-2 text-xs font-medium text-neutral-400">Tempo médio (início → conclusão) por tipo</div>
          <div className="space-y-1">
            {Object.entries(stats.tempos.porTipoHoras).map(([tipo, h]) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">{tipo}</span>
                <span className="font-medium text-neutral-100">{formatDuracao(h as number | null)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Valores (orçamentos do período)</h2>
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 text-xs font-medium text-neutral-400">{label}</div>
      <div className="text-lg font-bold text-white sm:text-xl">{value}</div>
    </div>
  );
}
