import { PainelFaturacao } from "@/components/PainelFaturacao";

export default async function FinanceiroFaturacaoPage({ searchParams }: { searchParams: { q?: string } }) {
  return <PainelFaturacao q={searchParams.q} />;
}
