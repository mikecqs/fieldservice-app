"use client";

import * as XLSX from "xlsx";
import { formatDuracao, formatEuros, type FinanceiroRange } from "@/lib/financeiro";

type Stats = Awaited<ReturnType<typeof import("@/lib/financeiro").getFinanceiroStats>>;

// Exporta exatamente os números já calculados e mostrados no dashboard
// (respeitando o período selecionado) — não recalcula nada, só reorganiza os
// mesmos dados em folhas separadas dentro de um único ficheiro Excel.
export function ExportarFinanceiroExcel({ stats, range }: { stats: Stats; range: FinanceiroRange }) {
  const exportar = () => {
    const wb = XLSX.utils.book_new();

    const resumo = [
      ["Período", `${range.label} (${range.desde} a ${range.ate})`],
      [],
      ["Total faturado", formatEuros(stats.faturacao.totalFaturado)],
      ["Total por faturar", formatEuros(stats.faturacao.totalPorFaturar)],
      ["Nº serviços faturados", stats.faturacao.nFaturados],
      ["Valor médio por serviço", formatEuros(stats.faturacao.valorMedio)],
      [],
      ["Concluídos no período", stats.producao.concluidos],
      ["Pendentes (agora)", stats.producao.pendentes],
      ["Novas visitas", stats.producao.novasVisitas],
      ["Não realizados", stats.producao.naoRealizados],
      ["Orçamentos criados", stats.producao.orcamentos],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

    const faturacao = [
      ["Indicador", "Valor"],
      ["Total faturado", stats.faturacao.totalFaturado],
      ["Total por faturar", stats.faturacao.totalPorFaturar],
      ["Nº serviços faturados", stats.faturacao.nFaturados],
      ["Valor médio por serviço", stats.faturacao.valorMedio],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(faturacao), "Faturação");

    const producao = [
      ["Indicador", "Valor"],
      ["Concluídos no período", stats.producao.concluidos],
      ["Pendentes (agora)", stats.producao.pendentes],
      ["Novas visitas", stats.producao.novasVisitas],
      ["Não realizados", stats.producao.naoRealizados],
      ["Orçamentos criados", stats.producao.orcamentos],
      ["Serviço mais realizado", stats.producao.servicoMaisRealizado ?? "—"],
      [],
      ["Concluídos por tipo", ""],
      ...Object.entries(stats.producao.porTipo).map(([tipo, n]) => [tipo, n]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(producao), "Serviços");

    const tempos = [
      ["Transição", "Tempo médio (horas)"],
      ["Pedido → orçamento", stats.tempos.pedidoOrcamentoHoras],
      ["Pedido → agendamento", stats.tempos.pedidoAgendamentoHoras],
      ["Pedido → conclusão", stats.tempos.pedidoConclusaoHoras],
      ["Agendamento → início", stats.tempos.agendamentoInicioHoras],
      ["Início → conclusão", stats.tempos.inicioConclusaoHoras],
      ["Fecho → validação", stats.tempos.fechoValidacaoHoras],
      ["Validação → faturação", stats.tempos.validacaoFaturacaoHoras],
      ["Pedido → faturação", stats.tempos.pedidoFaturacaoHoras],
      [],
      ["Tempo médio (início → conclusão) por tipo", ""],
      ...Object.entries(stats.tempos.porTipoHoras).map(([tipo, h]) => [tipo, h]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tempos), "Tempos");

    const valores = [
      ["Valor", "Total"],
      ["Mão de obra", stats.valores.mao_obra],
      ["Materiais", stats.valores.materiais],
      ["Deslocações", stats.valores.deslocacao],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(valores), "Valores");

    XLSX.writeFile(wb, `estatisticas-nexia-${range.desde}-a-${range.ate}.xlsx`);
  };

  return (
    <button
      onClick={exportar}
      className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
    >
      Exportar Excel
    </button>
  );
}
