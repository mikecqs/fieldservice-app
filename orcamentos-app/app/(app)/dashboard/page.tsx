import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import { ESTADOS_GANHOS, ESTADOS_ORCAMENTO, ROTULOS_ESTADO, type EstadoOrcamento } from "@/lib/orcamento-estado";
import DashboardChart from "./DashboardChart";

const ESTADOS_ATIVOS: readonly EstadoOrcamento[] = ["rascunho", "enviado", "followup"];

export default async function DashboardPage() {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: orcamentos } = await supabase
    .from("budgets")
    .select("id, estado, criado_em, followup_em, iva_percent, budget_items(quantidade, valor_unitario)")
    .eq("company_id", empresa.id);

  const linhas = (orcamentos ?? []).map((orcamento) => {
    const items = (orcamento.budget_items ?? []) as { quantidade: number; valor_unitario: number }[];
    const { total } = calcularOrcamento(items, orcamento.iva_percent);
    return {
      estado: orcamento.estado as EstadoOrcamento,
      criadoEm: orcamento.criado_em as string,
      followupEm: orcamento.followup_em as string | null,
      total,
    };
  });

  const contagemPorEstado = Object.fromEntries(
    ESTADOS_ORCAMENTO.map((estado) => [estado, linhas.filter((l) => l.estado === estado).length])
  ) as Record<EstadoOrcamento, number>;

  const valorPipeline = linhas
    .filter((l) => ESTADOS_ATIVOS.includes(l.estado))
    .reduce((acc, l) => acc + l.total, 0);

  const valorAceites = linhas
    .filter((l) => (ESTADOS_GANHOS as readonly string[]).includes(l.estado))
    .reduce((acc, l) => acc + l.total, 0);

  const aceites = contagemPorEstado.aceite + contagemPorEstado.servico_realizado + contagemPorEstado.faturado;
  const recusados = contagemPorEstado.recusado;
  const taxaAceitacao = aceites + recusados > 0 ? (aceites / (aceites + recusados)) * 100 : null;

  const hoje = new Date().toISOString().slice(0, 10);
  const followupsAtrasados = linhas.filter(
    (l) => l.followupEm && l.followupEm < hoje && ESTADOS_ATIVOS.includes(l.estado)
  ).length;
  const followupsHoje = linhas.filter((l) => l.followupEm === hoje).length;

  // Últimos 6 meses: criados vs. aceites, por mês de criação.
  const meses: { chave: string; mes: string; criados: number; aceites: number }[] = [];
  const referencia = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    meses.push({
      chave,
      mes: d.toLocaleDateString("pt-PT", { month: "short" }),
      criados: 0,
      aceites: 0,
    });
  }
  for (const linha of linhas) {
    const chave = linha.criadoEm.slice(0, 7);
    const mes = meses.find((m) => m.chave === chave);
    if (!mes) continue;
    mes.criados += 1;
    if ((ESTADOS_GANHOS as readonly string[]).includes(linha.estado)) mes.aceites += 1;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold tracking-tight text-white">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CartaoKpi titulo="Valor em pipeline" valor={`${valorPipeline.toFixed(2)} €`} nota="Rascunho + enviado + follow-up" />
        <CartaoKpi titulo="Valor total aceite" valor={`${valorAceites.toFixed(2)} €`} nota="Soma dos orçamentos aceites" />
        <CartaoKpi
          titulo="Taxa de aceitação"
          valor={taxaAceitacao === null ? "—" : `${taxaAceitacao.toFixed(0)}%`}
          nota="Aceites ÷ (aceites + recusados)"
        />
        <CartaoKpi
          titulo="Follow-up atrasado"
          valor={String(followupsAtrasados)}
          nota="Ver em Follow-up"
          destaque={followupsAtrasados > 0}
        />
        <CartaoKpi titulo="Follow-up hoje" valor={String(followupsHoje)} nota="Ver em Follow-up" />
      </div>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-200">Por estado</h2>
        <div className="flex flex-wrap gap-3">
          {ESTADOS_ORCAMENTO.map((estado) => (
            <Link
              key={estado}
              href={`/orcamentos?estado=${estado}`}
              className="rounded-xl border border-edge px-4 py-3 text-center transition-colors hover:border-edge-subtle hover:bg-surface-raised"
            >
              <div className="text-xl font-semibold text-white">{contagemPorEstado[estado]}</div>
              <div className="text-xs text-muted">{ROTULOS_ESTADO[estado]}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-200">Últimos 6 meses</h2>
        <DashboardChart dados={meses} />
      </section>
    </div>
  );
}

function CartaoKpi({
  titulo,
  valor,
  nota,
  destaque,
}: {
  titulo: string;
  valor: string;
  nota: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-surface p-5 ${destaque ? "border-red-500/30" : "border-edge"}`}>
      <div className="text-xs text-muted">{titulo}</div>
      <div className={`mt-1 text-2xl font-semibold ${destaque ? "text-red-400" : "text-white"}`}>{valor}</div>
      <div className="mt-1 text-xs text-muted-foreground">{nota}</div>
    </div>
  );
}
