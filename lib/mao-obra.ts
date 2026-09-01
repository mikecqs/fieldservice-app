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
// Ambas só leem horas (para estatísticas), nunca o preço — a etapa "Preços
// da mão de obra" (calcularPrecoMaoObra, abaixo) não lhes diz respeito.
// "Visita para Orçamento" e "Taxa de Deslocação" foram acrescentadas antes
// de "1 hora" — são valores fixos configuráveis (org_settings), nunca uma
// duração real, por isso ficam de fora de HORAS_MAO_OBRA/
// sugerirMaoObraPorDuracao abaixo, no mesmo espírito de "outro".
export const MAO_OBRA_OPCOES: [string, string][] = [
  ["visita_orcamento", "Visita para Orçamento"],
  ["taxa_deslocacao", "Taxa de Deslocação"],
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
  dia_completo: 8, "2dias": 16, outro: 0, visita_orcamento: 0, taxa_deslocacao: 0,
};

// Nunca sugeridas por duração (mesmo critério de "outro" em
// sugerirMaoObraPorDuracao) — são categorias fixas, não uma duração real.
const TIPOS_SEM_DURACAO_REAL = new Set(["outro", "visita_orcamento", "taxa_deslocacao"]);

// Tabela comercial de preços (Etapa "Preços da mão de obra"): 1ª hora já
// inclui deslocação, horas seguintes a preço avulso, "dia completo"/8h e "2
// dias completos" são valores fixos explícitos (nunca derivados de horas ×
// taxa). Mesma fórmula da RPC `tech_finish_visit` (supabase/schema.sql) —
// duplicação documentada, não eliminada, pela mesma razão do bucket→horas
// acima: qualquer mudança na tabela comercial tem de ser replicada à mão
// aqui e lá, ou o preview deixa de bater certo com o valor realmente
// gravado.
export type PrecosMaoObra = {
  primeiraHora: number;
  horaAdicional: number;
  diaCompleto: number;
  doisDias: number;
  visitaOrcamento: number;
  taxaDeslocacao: number;
};

export function calcularPrecoMaoObra(tipo: string, precos: PrecosMaoObra): number {
  switch (tipo) {
    case "visita_orcamento":
      return precos.visitaOrcamento;
    case "taxa_deslocacao":
      return precos.taxaDeslocacao;
    case "1h":
      return precos.primeiraHora;
    case "2h":
      return precos.primeiraHora + 1 * precos.horaAdicional;
    case "3h":
      return precos.primeiraHora + 2 * precos.horaAdicional;
    case "4h":
      return precos.primeiraHora + 3 * precos.horaAdicional;
    case "5h":
      return precos.primeiraHora + 4 * precos.horaAdicional;
    case "6h":
      return precos.primeiraHora + 5 * precos.horaAdicional;
    case "7h":
      return precos.primeiraHora + 6 * precos.horaAdicional;
    case "8h":
    case "dia_completo":
      return precos.diaCompleto;
    case "2dias":
      return precos.doisDias;
    default:
      return 0;
  }
}

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
    if (TIPOS_SEM_DURACAO_REAL.has(tipo)) continue;
    const diferenca = Math.abs(horas - horasReais);
    if (diferenca < menorDiferenca) {
      menorDiferenca = diferenca;
      melhor = tipo;
    }
  }
  return melhor;
}
