import { createClient } from "@/lib/supabase/server";
import { computeRange, getFinanceiroStats } from "@/lib/financeiro";
import { DashboardFinanceiro } from "@/components/DashboardFinanceiro";

export default async function FinanceiroAdminPage({
  searchParams,
}: {
  searchParams: { range?: string; desde?: string; ate?: string };
}) {
  const supabase = createClient();
  const preset = searchParams.range ?? "mes";
  const range = computeRange(preset, searchParams.desde, searchParams.ate);
  const stats = await getFinanceiroStats(supabase, range.desde, range.ate);

  // Renomeado para "Relatórios Financeiros" no menu Admin e aqui — era
  // "Financeiro", confundível com a lista de trabalho de faturação (que
  // passou a chamar-se "Financeiro"). O painel do papel FINANCE
  // (/financeiro) mantém o nome original "Dashboard financeiro".
  return <DashboardFinanceiro basePath="/admin/financeiro" preset={preset} range={range} stats={stats} titulo="Relatórios Financeiros" />;
}
