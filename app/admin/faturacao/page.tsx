import { PainelFaturacao } from "@/components/PainelFaturacao";

export default async function FaturacaoPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  // Renomeado para "Financeiro" no menu Admin e aqui (o antigo "Financeiro"
  // passou a "Relatórios Financeiros") — o nome "Faturação" confundia com o
  // dashboard de estatísticas, quando esta é a lista de trabalho real
  // (validar, rejeitar, marcar faturado). Sem alterar dados nem ações; o
  // painel do papel FINANCE (/financeiro/faturacao) mantém o nome original.
  return <PainelFaturacao q={searchParams.q} titulo="Financeiro" />;
}
