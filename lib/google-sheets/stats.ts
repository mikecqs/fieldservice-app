import { getFinanceiroStats, formatDuracao, formatEuros } from "@/lib/financeiro";
import { updateValues } from "./sheets-api";

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Reaproveita exatamente a mesma lógica já testada do Dashboard Financeiro
// da nexIA (lib/financeiro.ts) — nunca recalcula estatísticas de outra
// forma. organizationId é passado explicitamente porque este código corre
// com o cliente service role (ignora RLS): é o único filtro de isolamento
// aqui, por isso as 3 chamadas abaixo têm sempre de o levar.
export async function writeStats(admin: any, accessToken: string, spreadsheetId: string, organizationId: string) {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioAno = new Date(hoje.getFullYear(), 0, 1);

  const [statsHoje, statsMes, statsAno] = await Promise.all([
    getFinanceiroStats(admin, toISO(hoje), toISO(hoje), organizationId),
    getFinanceiroStats(admin, toISO(inicioMes), toISO(hoje), organizationId),
    getFinanceiroStats(admin, toISO(inicioAno), toISO(hoje), organizationId),
  ]);

  // Contagens instantâneas de orçamentos (não são "do período", são o
  // estado atual) — pedidas à parte por não fazerem parte do dashboard
  // financeiro interno da nexIA.
  const { data: orcamentos } = await admin.from("budgets").select("estado").eq("organization_id", organizationId);
  const pendentes = (orcamentos ?? []).filter((o: any) => o.estado === "aguarda_resposta" || o.estado === "enviado" || o.estado === "followup").length;
  const aceites = (orcamentos ?? []).filter((o: any) => o.estado === "aceite").length;
  const recusados = (orcamentos ?? []).filter((o: any) => o.estado === "recusado").length;

  const linhas: (string | number)[][] = [
    ["Serviços concluídos", statsHoje.producao.concluidos, statsMes.producao.concluidos, statsAno.producao.concluidos],
    ["Serviços pendentes (agora)", statsHoje.producao.pendentes, statsMes.producao.pendentes, statsAno.producao.pendentes],
    ["OS não realizadas", statsHoje.producao.naoRealizados, statsMes.producao.naoRealizados, statsAno.producao.naoRealizados],
    ["Novas visitas", statsHoje.producao.novasVisitas, statsMes.producao.novasVisitas, statsAno.producao.novasVisitas],
    ["Orçamentos criados", statsHoje.producao.orcamentos, statsMes.producao.orcamentos, statsAno.producao.orcamentos],
    ["Orçamentos pendentes (agora)", pendentes, pendentes, pendentes],
    ["Orçamentos aceites (agora)", aceites, aceites, aceites],
    ["Orçamentos recusados (agora)", recusados, recusados, recusados],
    ["Total faturado", formatEuros(statsHoje.faturacao.totalFaturado), formatEuros(statsMes.faturacao.totalFaturado), formatEuros(statsAno.faturacao.totalFaturado)],
    ["Total por faturar (agora)", formatEuros(statsHoje.faturacao.totalPorFaturar), formatEuros(statsMes.faturacao.totalPorFaturar), formatEuros(statsAno.faturacao.totalPorFaturar)],
    ["Faturado por receber", formatEuros(statsHoje.faturacao.totalPorReceber), formatEuros(statsMes.faturacao.totalPorReceber), formatEuros(statsAno.faturacao.totalPorReceber)],
    ["Total recebido", formatEuros(statsHoje.faturacao.totalRecebido), formatEuros(statsMes.faturacao.totalRecebido), formatEuros(statsAno.faturacao.totalRecebido)],
    ["Valor médio por serviço", formatEuros(statsHoje.faturacao.valorMedio), formatEuros(statsMes.faturacao.valorMedio), formatEuros(statsAno.faturacao.valorMedio)],
    ["Tempo médio pedido → orçamento", formatDuracao(statsHoje.tempos.pedidoOrcamentoHoras), formatDuracao(statsMes.tempos.pedidoOrcamentoHoras), formatDuracao(statsAno.tempos.pedidoOrcamentoHoras)],
    ["Tempo médio pedido → agendamento", formatDuracao(statsHoje.tempos.pedidoAgendamentoHoras), formatDuracao(statsMes.tempos.pedidoAgendamentoHoras), formatDuracao(statsAno.tempos.pedidoAgendamentoHoras)],
    ["Tempo médio agendamento → início", formatDuracao(statsHoje.tempos.agendamentoInicioHoras), formatDuracao(statsMes.tempos.agendamentoInicioHoras), formatDuracao(statsAno.tempos.agendamentoInicioHoras)],
    ["Tempo médio início → fecho", formatDuracao(statsHoje.tempos.inicioConclusaoHoras), formatDuracao(statsMes.tempos.inicioConclusaoHoras), formatDuracao(statsAno.tempos.inicioConclusaoHoras)],
    ["Tempo médio fecho → validação", formatDuracao(statsHoje.tempos.fechoValidacaoHoras), formatDuracao(statsMes.tempos.fechoValidacaoHoras), formatDuracao(statsAno.tempos.fechoValidacaoHoras)],
    ["Tempo médio validação → faturação", formatDuracao(statsHoje.tempos.validacaoFaturacaoHoras), formatDuracao(statsMes.tempos.validacaoFaturacaoHoras), formatDuracao(statsAno.tempos.validacaoFaturacaoHoras)],
    ["Tempo médio pedido → faturação", formatDuracao(statsHoje.tempos.pedidoFaturacaoHoras), formatDuracao(statsMes.tempos.pedidoFaturacaoHoras), formatDuracao(statsAno.tempos.pedidoFaturacaoHoras)],
    ["Tempo médio faturação → liquidação", formatDuracao(statsHoje.tempos.faturacaoLiquidacaoHoras), formatDuracao(statsMes.tempos.faturacaoLiquidacaoHoras), formatDuracao(statsAno.tempos.faturacaoLiquidacaoHoras)],
    ["Mão de obra (valor)", formatEuros(statsHoje.valores.mao_obra), formatEuros(statsMes.valores.mao_obra), formatEuros(statsAno.valores.mao_obra)],
    ["Materiais (valor)", formatEuros(statsHoje.valores.materiais), formatEuros(statsMes.valores.materiais), formatEuros(statsAno.valores.materiais)],
    ["Serviço mais realizado", statsHoje.producao.servicoMaisRealizado ?? "—", statsMes.producao.servicoMaisRealizado ?? "—", statsAno.producao.servicoMaisRealizado ?? "—"],
  ];

  const cabecalho = [["Indicador", "Hoje", "Este mês", "Este ano"]];
  const atualizado = [[`Última atualização: ${new Date().toLocaleString("pt-PT")}`]];

  await Promise.all([
    updateValues(accessToken, spreadsheetId, "Estatísticas!A1", [...cabecalho, ...linhas]),
    updateValues(accessToken, spreadsheetId, "Estatísticas!A" + (linhas.length + 3), atualizado),
    // O Dashboard mostra só os indicadores mais importantes para a chefia
    // decidir rapidamente "onde estamos a perder tempo" — o resto fica na
    // folha Estatísticas, mais completa.
    updateValues(accessToken, spreadsheetId, "Dashboard!A7", [
      ["Serviços concluídos", statsHoje.producao.concluidos, statsMes.producao.concluidos, statsAno.producao.concluidos],
      ["Serviços pendentes (agora)", statsHoje.producao.pendentes, statsMes.producao.pendentes, statsAno.producao.pendentes],
      ["OS não realizadas", statsHoje.producao.naoRealizados, statsMes.producao.naoRealizados, statsAno.producao.naoRealizados],
      ["Orçamentos pendentes (agora)", pendentes, pendentes, pendentes],
      ["Total faturado", formatEuros(statsHoje.faturacao.totalFaturado), formatEuros(statsMes.faturacao.totalFaturado), formatEuros(statsAno.faturacao.totalFaturado)],
      ["Total por faturar (agora)", formatEuros(statsHoje.faturacao.totalPorFaturar), formatEuros(statsMes.faturacao.totalPorFaturar), formatEuros(statsAno.faturacao.totalPorFaturar)],
      ["Total recebido", formatEuros(statsHoje.faturacao.totalRecebido), formatEuros(statsMes.faturacao.totalRecebido), formatEuros(statsAno.faturacao.totalRecebido)],
      ["Tempo médio de execução (início → fecho)", formatDuracao(statsHoje.tempos.inicioConclusaoHoras), formatDuracao(statsMes.tempos.inicioConclusaoHoras), formatDuracao(statsAno.tempos.inicioConclusaoHoras)],
      ["Tempo médio de agendamento (pedido → agendamento)", formatDuracao(statsHoje.tempos.pedidoAgendamentoHoras), formatDuracao(statsMes.tempos.pedidoAgendamentoHoras), formatDuracao(statsAno.tempos.pedidoAgendamentoHoras)],
      ["Tempo médio de faturação (pedido → faturação)", formatDuracao(statsHoje.tempos.pedidoFaturacaoHoras), formatDuracao(statsMes.tempos.pedidoFaturacaoHoras), formatDuracao(statsAno.tempos.pedidoFaturacaoHoras)],
      ["Ver folha \"Estatísticas\" para a lista completa de indicadores.", "", "", ""],
    ]),
  ]);
}
