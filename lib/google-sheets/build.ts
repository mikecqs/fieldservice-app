import { createSpreadsheet, updateValues, batchUpdate } from "./sheets-api";
import { SHEET_NAMES, HEADERS } from "./layout";
import { writeStats } from "./stats";

// Cria o Google Sheet da empresa com todas as folhas, cabeçalhos formatados
// e o Dashboard/Estatísticas inicial. Chamado uma única vez, no momento em
// que a integração é ligada (callback do OAuth).
export async function buildCompanySpreadsheet(admin: any, accessToken: string, organizationId: string, empresaNome: string) {
  const title = `nexIA — ${empresaNome}`;
  const { spreadsheetId, sheets } = await createSpreadsheet(accessToken, title, [...SHEET_NAMES]);
  const sheetIdByName = new Map<string, number>(sheets.map((s: any) => [s.properties.title, s.properties.sheetId]));

  // Cabeçalhos de todas as folhas de dados (tudo menos Dashboard/Estatísticas,
  // que têm layout próprio).
  const dataRequests = (Object.keys(HEADERS) as (keyof typeof HEADERS)[]).map((sheet) =>
    updateValues(accessToken, spreadsheetId, `${sheet}!A1`, [HEADERS[sheet]])
  );
  await Promise.all(dataRequests);

  // Cabeçalho a negrito + fundo escuro em todas as folhas, para ficar claro
  // o que é título de coluna (a chefia vai passar a maior parte do tempo a
  // filtrar/ordenar estas folhas).
  const formatRequests = Array.from(sheetIdByName.entries()).map(([, sheetId]) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
      fields: "userEnteredFormat(textFormat,backgroundColor)",
    },
  }));
  await batchUpdate(accessToken, spreadsheetId, formatRequests);

  await writeDashboardSkeleton(accessToken, spreadsheetId);
  await writeStats(admin, accessToken, spreadsheetId, organizationId);

  return { spreadsheetId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}

async function writeDashboardSkeleton(accessToken: string, spreadsheetId: string) {
  const values = [
    ["Dashboard de gestão — nexIA"],
    [""],
    ["Os números abaixo atualizam-se automaticamente a cada sincronização (Hoje / Este mês / Este ano)."],
    ["Para analisar um período específico ou cruzar com registos individuais, usa as folhas Serviços, Visitas, Orçamentos e Histórico — todas têm o ID de cada registo para permitir esse cruzamento."],
    [""],
    ["Indicador", "Hoje", "Este mês", "Este ano"],
  ];
  await updateValues(accessToken, spreadsheetId, "Dashboard!A1", values);
}
