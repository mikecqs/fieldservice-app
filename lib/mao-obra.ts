// Onda 2 — fonte única, do lado do fluxo do Técnico, para as opções de mão
// de obra do fecho de OS e a sua conversão em horas. Antes desta onda, esta
// tabela vivia só dentro de
// app/tecnico/servico/[id]/ServicoDetalheClient.tsx — usada apenas para a
// pré-visualização do total mostrado ao Técnico. Continua a ser exatamente
// isso: uma pré-visualização, nunca o cálculo que fica gravado.
//
// A RPC `tech_finish_visit` (supabase/schema.sql) tem a MESMA conversão
// bucket → horas dentro de um `case` em PL/pgSQL — é ela quem decide de
// facto o valor faturado, nunca este ficheiro. Não é seguro (nem está no
// âmbito desta onda) fazer o SQL ler este ficheiro TypeScript, por isso essa
// duplicação específica (aqui vs. a RPC) fica documentada, não eliminada:
// qualquer mudança nos buckets/horas tem de ser replicada à mão também em
// tech_finish_visit, ou a pré-visualização e a sugestão automática deixam de
// bater certo com o valor realmente faturado.
//
// Nota: encontraram-se durante esta onda mais duas cópias independentes
// (mas hoje idênticas) desta mesma tabela em lib/relatorios.ts e
// lib/google-sheets/rows.ts, usadas em relatórios/exportações do Admin —
// fora do fluxo do Técnico, por isso deixadas como estavam nesta onda.
export const MAO_OBRA_OPCOES: [string, string][] = [
  ["1h", "1 hora"],
  ["2h", "2 horas"],
  ["3h", "3 horas"],
  ["4h", "4 horas"],
  ["5h", "5 horas"],
  ["6h", "6 horas"],
  ["7h", "7 horas"],
  ["8h", "8 horas"],
  ["dia_completo", "Dia completo"],
  ["2dias", "2 dias completos"],
  ["outro", "Outro"],
];

export const HORAS_MAO_OBRA: Record<string, number> = {
  "1h": 1, "2h": 2, "3h": 3, "4h": 4, "5h": 5, "6h": 6, "7h": 7, "8h": 8,
  dia_completo: 8, "2dias": 16, outro: 0,
};

// Bucket existente mais próximo de uma duração real, em minutos — nunca
// inventa uma opção nova, só escolhe entre as que já existem em
// HORAS_MAO_OBRA (exclui "outro", que não tem duração fixa nenhuma para
// comparar). Serve só de sugestão inicial no formulário de fecho do
// Técnico; ele continua sempre livre para escolher outra opção.
export function sugerirMaoObraPorDuracao(minutos: number): string {
  const horasReais = minutos / 60;
  let melhor = "1h";
  let menorDiferenca = Infinity;
  for (const [tipo, horas] of Object.entries(HORAS_MAO_OBRA)) {
    if (tipo === "outro") continue;
    const diferenca = Math.abs(horas - horasReais);
    if (diferenca < menorDiferenca) {
      menorDiferenca = diferenca;
      melhor = tipo;
    }
  }
  return melhor;
}
