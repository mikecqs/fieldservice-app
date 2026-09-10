// Regras do ciclo de vida do orçamento — única fonte de verdade das
// transições de estado, usada tanto nas Server Actions (validação real)
// como na UI (mostrar/esconder as ações certas), para nunca haver duas
// regras divergentes entre servidor e ecrã.

export const ESTADOS_ORCAMENTO = [
  "rascunho",
  "enviado",
  "followup",
  "aceite",
  "servico_realizado",
  "faturado",
  "recusado",
  "cancelado",
] as const;

export type EstadoOrcamento = (typeof ESTADOS_ORCAMENTO)[number];

// Um orçamento só fica mesmo concluído (nunca mais volta a mudar de
// estado) depois de faturado — "aceite" e "servico_realizado" continuam
// não-terminais porque ainda têm um passo seguinte explícito.
export const ESTADOS_ORCAMENTO_TERMINAIS = ["faturado", "recusado", "cancelado"] as const;

// Estados que contam como "negócio ganho" para efeitos de relatórios
// (valor aceite, taxa de aceitação) — inclui tudo depois de aceite, não
// só quem ainda está literalmente no estado "aceite" (a maioria avança
// rápido para servico_realizado/faturado).
export const ESTADOS_GANHOS = ["aceite", "servico_realizado", "faturado"] as const;

export const ROTULOS_ESTADO: Record<EstadoOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  followup: "Follow-up marcado",
  aceite: "Aceite",
  servico_realizado: "Serviço realizado",
  faturado: "Faturado",
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

// Aceitar/recusar: só antes de uma decisão já tomada — nunca a partir de
// "aceite" em diante (já não faz sentido aceitar/recusar outra vez algo
// que já está a ser executado ou faturado).
const ESTADOS_PRE_DECISAO = ["rascunho", "enviado", "followup"] as const;

export function podeAceitarOrcamento(orcamento: { estado: string }): boolean {
  return (ESTADOS_PRE_DECISAO as readonly string[]).includes(orcamento.estado);
}

export function podeRecusarOrcamento(orcamento: { estado: string }): boolean {
  return (ESTADOS_PRE_DECISAO as readonly string[]).includes(orcamento.estado);
}

// Cancelar continua disponível um pouco mais além (até o serviço estar
// realizado) — é a válvula de escape se o cliente desistir a meio,
// mesmo já depois de aceite. Nunca depois de faturado.
export function podeCancelarOrcamento(orcamento: { estado: string }): boolean {
  return !ehTerminal(orcamento.estado);
}

// Serviço realizado: só depois de aceite, antes de faturado.
export function podeMarcarServicoRealizado(orcamento: { estado: string }): boolean {
  return orcamento.estado === "aceite";
}

// Faturado: o único caminho para o orçamento ficar mesmo concluído — só
// alcançável depois de o serviço ter sido marcado como realizado. Nunca
// se salta de "aceite" direto para "faturado".
export function podeMarcarFaturado(orcamento: { estado: string }): boolean {
  return orcamento.estado === "servico_realizado";
}
