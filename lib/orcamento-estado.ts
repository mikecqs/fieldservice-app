// Regras do ciclo de vida do Orçamento — mesmo espírito de
// lib/servico-estado.ts (auditoria BLOCO 5, aplicada aqui ao BLOCO 6): uma
// única fonte de verdade por regra, para nunca haver duas versões
// diferentes entre servidor e UI.

export const ESTADOS_ORCAMENTO_TERMINAIS = ["aceite", "recusado", "cancelado"] as const;

// Itens e IVA só podem ser editados enquanto o orçamento ainda está em
// rascunho — depois de enviado, o que o cliente recebeu tem de continuar a
// bater certo com o que fica gravado; uma vez aceite, o valor já foi
// congelado no serviço criado por aceitarOrcamento (calcularOrcamento só
// corre nesse momento).
export function podeEditarItensOrcamento(orcamento: { estado: string }): boolean {
  return orcamento.estado === "rascunho";
}

// Marcar como enviado só faz sentido a partir de rascunho — evita reenviar
// (e recriar o follow-up automático de 7 dias) um orçamento que já saiu.
export function podeMarcarEnviado(orcamento: { estado: string }): boolean {
  return orcamento.estado === "rascunho";
}

// Aceitar cria sempre um serviço novo — nunca pode ser chamado duas vezes
// sobre o mesmo orçamento (criaria um segundo serviço órfão ligado ao
// mesmo orçamento), nem sobre um orçamento já recusado/cancelado.
export function podeAceitarOrcamento(orcamento: { estado: string }): boolean {
  return !(ESTADOS_ORCAMENTO_TERMINAIS as readonly string[]).includes(orcamento.estado);
}

// Transições manuais (avancarEstado) — mesmas que a UI já oferecia, agora
// também validadas no servidor: cada estado de destino só é alcançável a
// partir dos estados de origem que já eram os únicos a mostrar o botão
// correspondente em app/admin/orcamentos/[id]/page.tsx.
const ORIGENS_PERMITIDAS_POR_DESTINO: Record<string, readonly string[]> = {
  aguarda_resposta: ["enviado"],
  followup: ["enviado", "aguarda_resposta"],
  recusado: ["rascunho", "enviado", "aguarda_resposta", "followup"],
  cancelado: ["rascunho", "enviado", "aguarda_resposta", "followup"],
};

export function podeAvancarParaEstado(orcamento: { estado: string }, destino: string): boolean {
  const origens = ORIGENS_PERMITIDAS_POR_DESTINO[destino];
  if (!origens) return false;
  return origens.includes(orcamento.estado);
}
