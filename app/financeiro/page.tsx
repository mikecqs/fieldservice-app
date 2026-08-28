import { createClient } from "@/lib/supabase/server";
import { computeRange, getFinanceiroStats } from "@/lib/financeiro";
import { DashboardFinanceiro } from "@/components/DashboardFinanceiro";

export default async function FinanceiroDashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; desde?: string; ate?: string };
}) {
  const supabase = createClient();
  const preset = searchParams.range ?? "mes";
  const range = computeRange(preset, searchParams.desde, searchParams.ate);
  const stats = await getFinanceiroStats(supabase, range.desde, range.ate);

  return <DashboardFinanceiro basePath="/financeiro" preset={preset} range={range} stats={stats} />;
}
