// Regras do ciclo de vida do Serviço/OS que têm de dar exatamente o mesmo
// resultado em todos os sítios onde se aplicam (servidor e UI, Agenda e
// ficha do Serviço) — uma única fonte de verdade por regra, para nunca
// divergirem entre si (auditoria BLOCO 5).

// Estados a partir dos quais um serviço já não pode ser reagendado (data,
// hora ou técnico) — o trabalho já terminou de alguma forma. Combinado
// sempre com faturacao_estado (abaixo), porque um serviço 'concluido' pode
// já estar faturado mesmo antes de mudar de estado outra vez.
export const ESTADOS_SERVICO_BLOQUEADOS_PARA_REAGENDAR = ["concluido", "cancelado", "nao_realizado"] as const;

export function podeReagendarServico(servico: { estado: string; faturacao_estado?: string | null }): boolean {
  if ((ESTADOS_SERVICO_BLOQUEADOS_PARA_REAGENDAR as readonly string[]).includes(servico.estado)) return false;
  if (servico.faturacao_estado === "faturado") return false;
  return true;
}

// Estados que, ao ganharem data/hora válida, transicionam automaticamente
// para "agendado" — mesma regra em atualizarAgendamento (ficha do serviço)
// e criarOuAgendarNoPopup (Agenda), que antes divergiam entre si.
export const ESTADOS_QUE_AUTO_AGENDAM = ["por_agendar", "nova_visita"] as const;

export function deveTransicionarParaAgendado(estadoAtual: string): boolean {
  return (ESTADOS_QUE_AUTO_AGENDAM as readonly string[]).includes(estadoAtual);
}

// Um serviço só pode ser cancelado se ainda não tiver terminado (concluído)
// nem já estiver faturado — cancelar depois disso não faz sentido de
// negócio e apagaria valor real já faturado do radar operacional.
export function podeCancelarServico(servico: { estado: string; faturacao_estado?: string | null }): boolean {
  if (servico.estado === "concluido" || servico.estado === "cancelado") return false;
  if (servico.faturacao_estado === "faturado") return false;
  return true;
}

// Único caminho legítimo de saída de 'nao_realizado' (que está em
// ESTADOS_SERVICO_BLOQUEADOS_PARA_REAGENDAR acima, de propósito — não pode
// ser editado pelo caminho normal de reagendamento). "Reativar serviço" é a
// exceção explícita e guardada: só a partir de 'nao_realizado' exato, nunca
// se já estiver faturado.
export function podeReativarServico(servico: { estado: string; faturacao_estado?: string | null }): boolean {
  if (servico.estado !== "nao_realizado") return false;
  if (servico.faturacao_estado === "faturado") return false;
  return true;
}
