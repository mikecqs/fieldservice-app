// Regras do ciclo de vida do orçamento — única fonte de verdade das
// transições de estado, usada tanto nas Server Actions (validação real)
// como na UI (mostrar/esconder as ações certas), para nunca haver duas
// regras divergentes entre servidor e ecrã.

export const ESTADOS_ORCAMENTO = [
  "rascunho",
  "enviado",
  "followup",
  "aceite",
  "recusado",
  "cancelado",
] as const;

export type EstadoOrcamento = (typeof ESTADOS_ORCAMENTO)[number];

export const ESTADOS_ORCAMENTO_TERMINAIS = ["aceite", "recusado", "cancelado"] as const;

export const ROTULOS_ESTADO: Record<EstadoOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  followup: "Follow-up marcado",
  aceite: "Aceite",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

function ehTerminal(estado: string): boolean {
  return (ESTADOS_ORCAMENTO_TERMINAIS as readonly string[]).includes(estado);
}

// Itens e IVA só editáveis em rascunho — depois de enviado, o que o
// cliente recebeu tem de continuar a bater certo com o que fica gravado.
export function podeEditarItensOrcamento(orcamento: { estado: string }): boolean {
  return orcamento.estado === "rascunho";
}

// Marcar como enviado só a partir de rascunho.
export function podeMarcarEnviado(orcamento: { estado: string }): boolean {
  return orcamento.estado === "rascunho";
}

// Marcar follow-up: a partir de enviado ou de um follow-up anterior (nunca
// de rascunho — teria de ser enviado primeiro — nem de um estado terminal).
export function podeMarcarFollowup(orcamento: { estado: string }): boolean {
  return orcamento.estado === "enviado" || orcamento.estado === "followup";
}

// Aceitar/recusar/cancelar: a partir de qualquer estado não-terminal.
export function podeAceitarOrcamento(orcamento: { estado: string }): boolean {
  return !ehTerminal(orcamento.estado);
}

export function podeRecusarOrcamento(orcamento: { estado: string }): boolean {
  return !ehTerminal(orcamento.estado);
}

export function podeCancelarOrcamento(orcamento: { estado: string }): boolean {
  return !ehTerminal(orcamento.estado);
}
