import { PainelFaturacao } from "@/components/PainelFaturacao";

export default async function FinanceiroFaturacaoPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  return <PainelFaturacao q={searchParams.q} />;
}
