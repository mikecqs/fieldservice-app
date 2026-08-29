// Critérios operacionais que têm de dar exatamente o mesmo resultado em
// qualquer sítio da app onde aparecem (Dashboard, Atenção, Agenda) — uma
// única fonte de verdade por critério, para nunca divergirem entre si.

// Serviço "atrasado": ainda no estado "agendado" (o técnico nunca chegou a
// iniciar) e a hora prevista já passou. Quem chama já tem de ter filtrado
// o serviço para o dia certo (ex: data_agendada = hoje) — este critério só
// olha para estado/hora, não para a data.
export function estaAtrasado(servico: { estado: string; hora_agendada: string | null }, agoraHora: string): boolean {
  return servico.estado === "agendado" && !!servico.hora_agendada && servico.hora_agendada < agoraHora;
}

// Estados de serviço que significam "ainda não tem data/hora marcada,
// precisa de ser agendado" — usado tanto na Agenda ("Pendentes de
// agendamento") como no Dashboard ("Serviços por agendar"). Combinar sempre
// com `.is("data_agendada", null)`.
export const ESTADOS_SERVICO_POR_AGENDAR = ["por_agendar", "nova_visita"] as const;

// Orçamento "parado" — precisa de follow-up do Admin. Mesma lógica usada em
// Atenção e no Dashboard: se já está marcado como "followup", é sempre
// verdade; senão usa a data de follow-up automática (preenchida em
// marcarEnviado); só recai no `followup_dias_default` das Configurações
// para orçamentos antigos, criados antes de essa data existir.
export function orcamentoPrecisaFollowup(
  orcamento: { estado: string; enviado_em: string | null; followup_em: string | null },
  hojeISO: string,
  followupDiasDefault: number
): boolean {
  if (orcamento.estado === "followup") return true;
  if (orcamento.followup_em) return orcamento.followup_em <= hojeISO;
  if (!orcamento.enviado_em) return false;
  const diasPassados = (Date.now() - new Date(orcamento.enviado_em).getTime()) / 86400000;
  return diasPassados >= followupDiasDefault;
}
