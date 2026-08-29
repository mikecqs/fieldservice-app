"use client";

import * as XLSX from "xlsx";
import { formatDuracao, formatEuros, type FinanceiroRange } from "@/lib/financeiro";
import type { ServicoLinha } from "./TabelaServicos";

type Stats = Awaited<ReturnType<typeof import("@/lib/financeiro").getFinanceiroStats>>;
type Tecnico = { nome: string; concluidos: number; horas: number; tempoMedioHoras: number | null; novasVisitas: number };
type Tipo = { tipo: string; quantidade: number; tempoMedioHoras: number | null; valorMedio: number | null; maoObraHoras: number; materiaisValor: number };
type Orcamentos = {
  criados: number; enviados: number; aceites: number; recusados: number; pendentes: number;
  taxaAceitacao: number | null; valorTotal: number; valorAceite: number; tempoMedioRespostaHoras: number | null; followupsPendentes: number;
};
type Material = { nome: string; qtdUtilizada: number; valor: number; qtdPrevista: number | null };
type Agenda = { horasDisponiveis: number; horasAgendadas: number; horasTrabalhadas: number; taxaOcupacao: number | null; iniciadosAtrasados: number; reagendamentos: number };

type Props = {
  range: FinanceiroRange;
  stats: Stats;
  tecnicos: Tecnico[];
  tiposServico: Tipo[];
  orcamentos: Orcamentos;
  materiais: Material[];
  agenda: Agenda;
  linhas: ServicoLinha[];
};

function sheetResumo(range: FinanceiroRange, stats: Stats) {
  return [
    ["Período", `${range.label} (${range.desde} a ${range.ate})`],
    [],
    ["Serviços concluídos", stats.producao.concluidos],
    ["Total faturado", formatEuros(stats.faturacao.totalFaturado)],
    ["Total por faturar", formatEuros(stats.faturacao.totalPorFaturar)],
    ["Tempo médio (início → fecho)", formatDuracao(stats.tempos.inicioConclusaoHoras)],
    ["Novas visitas", stats.producao.novasVisitas],
  ];
}

function sheetTecnicos(tecnicos: Tecnico[]) {
  return [
    ["Técnico", "Serviços", "Horas", "Tempo médio", "Novas visitas"],
    ...tecnicos.map((t) => [t.nome, t.concluidos, t.horas, formatDuracao(t.tempoMedioHoras), t.novasVisitas]),
  ];
}

function sheetTipos(tiposServico: Tipo[]) {
  return [
    ["Tipo", "Quantidade", "Tempo médio", "Valor médio", "Mão de obra (h)", "Materiais (€)"],
    ...tiposServico.map((t) => [t.tipo, t.quantidade, formatDuracao(t.tempoMedioHoras), t.valorMedio !== null ? formatEuros(t.valorMedio) : "—", t.maoObraHoras, formatEuros(t.materiaisValor)]),
  ];
}

function sheetOrcamentos(o: Orcamentos) {
  return [
    ["Criados", o.criados], ["Enviados", o.enviados], ["Aceites", o.aceites], ["Recusados", o.recusados],
    ["Pendentes", o.pendentes], ["Taxa de aceitação", o.taxaAceitacao !== null ? `${o.taxaAceitacao.toFixed(0)}%` : "—"],
    ["Valor total", formatEuros(o.valorTotal)], ["Valor aceite", formatEuros(o.valorAceite)],
    ["Tempo médio até resposta", formatDuracao(o.tempoMedioRespostaHoras)], ["Follow-ups pendentes", o.followupsPendentes],
  ];
}

function sheetMateriais(materiais: Material[]) {
  return [
    ["Material", "Qtd utilizada", "Qtd prevista", "Valor"],
    ...materiais.map((m) => [m.nome, m.qtdUtilizada, m.qtdPrevista ?? "—", formatEuros(m.valor)]),
  ];
}

function sheetAgenda(a: Agenda) {
  return [
    ["Horas disponíveis (estimativa)", a.horasDisponiveis], ["Horas agendadas", a.horasAgendadas.toFixed(1)],
    ["Horas trabalhadas", a.horasTrabalhadas], ["Taxa de ocupação", a.taxaOcupacao !== null ? `${a.taxaOcupacao.toFixed(0)}%` : "—"],
    ["Serviços iniciados atrasados", a.iniciadosAtrasados], ["Reagendamentos", a.reagendamentos],
  ];
}

function sheetDados(linhas: ServicoLinha[]) {
  return [
    ["ID", "Cliente", "Tipo", "Estado", "Data", "Valor", "Estado faturação"],
    ...linhas.map((l) => [l.id, l.cliente, l.tipo, l.estado, l.data_agendada ?? "", l.valor, l.faturacao_estado]),
  ];
}

export function ExportarRelatoriosExcel({ range, stats, tecnicos, tiposServico, orcamentos, materiais, agenda, linhas }: Props) {
  const exportarAtual = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetResumo(range, stats)), "Resumo");
    XLSX.writeFile(wb, `relatorio-nexia-${range.desde}-a-${range.ate}.xlsx`);
  };

  const exportarTodos = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetResumo(range, stats)), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetTecnicos(tecnicos)), "Técnicos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetTipos(tiposServico)), "Tipos de serviço");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetOrcamentos(orcamentos)), "Orçamentos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetMateriais(materiais)), "Materiais");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetAgenda(agenda)), "Agenda");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetDados(linhas)), "Dados detalhados");
    XLSX.writeFile(wb, `relatorios-completo-nexia-${range.desde}-a-${range.ate}.xlsx`);
  };

  const exportarDados = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetDados(linhas)), "Dados detalhados");
    XLSX.writeFile(wb, `dados-detalhados-nexia-${range.desde}-a-${range.ate}.xlsx`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={exportarAtual} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800">
        Exportar relatório atual
      </button>
      <button onClick={exportarTodos} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800">
        Exportar todos os relatórios
      </button>
      <button onClick={exportarDados} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800">
        Exportar dados detalhados
      </button>
    </div>
  );
}
