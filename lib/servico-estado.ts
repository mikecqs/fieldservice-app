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

// "Visita de Orçamento" é um Serviço como outro qualquer — mesmo ciclo de
// vida, mesma Agenda, mesma execução pelo técnico — só com este tipo fixo,
// nunca o tipo original do Pedido (Manutenção/Instalação/Orçamento), para
// nunca ser confundida com um Serviço normal de execução. Duas origens
// possíveis, que a ficha do Serviço distingue pelo que fica preenchido:
//   Fluxo A — criarVisitaOrcamentoDePedido (app/admin/pedidos/actions.ts),
//   quando "É necessária visita prévia?" é "sim" a partir de um Pedido que
//   ainda não tem Orçamento nenhum: só `request_id` fica preenchido.
//   Fluxo B — agendarVisitaPreviaDoOrcamento (app/admin/orcamentos/actions.ts),
//   a partir de um Orçamento já existente (antes de aceite): `budget_id`
//   fica sempre preenchido (e também `request_id`, quando o orçamento tinha
//   um pedido de origem).
export const TIPO_VISITA_ORCAMENTO = "Visita de Orçamento";

// Rótulo visível ao utilizador para o tipo de Serviço — o valor gravado em
// `services.tipo` continua "Visita de Orçamento" (TIPO_VISITA_ORCAMENTO,
// nunca alterado: evita reescrever dados já gravados só por causa de uma
// string técnica), mas o utilizador vê sempre "Visita Prévia", em todo o
// lado onde `tipo` é mostrado (ficha do Serviço, listas, Agenda, Técnico,
// relatórios, faturação). Qualquer outro tipo passa tal e qual, sem mapa
// novo — mesmo padrão "passthrough" já usado no resto da app.
export function rotuloTipoServico(tipo: string): string {
  return tipo === TIPO_VISITA_ORCAMENTO ? "Visita Prévia" : tipo;
}

function eVisitaOrcamentoConcluida(servico: { tipo: string; estado: string }): boolean {
  return servico.tipo === TIPO_VISITA_ORCAMENTO && servico.estado === "concluido";
}

// Fluxo A — a visita veio de um Pedido sem Orçamento ainda: só aqui é que a
// ficha do Serviço oferece CRIAR o Orçamento a partir dela
// (criarOrcamentoDeVisita, em app/admin/servicos/actions.ts). `budget_id`
// presente significa Fluxo B (já existe um Orçamento — ver
// podeVoltarAoOrcamentoDaVisita abaixo), nunca os dois ao mesmo tempo.
export function podeGerarOrcamentoDeVisita(servico: {
  tipo: string;
  estado: string;
  request_id?: string | null;
  budget_id?: string | null;
}): boolean {
  return eVisitaOrcamentoConcluida(servico) && !!servico.request_id && !servico.budget_id;
}

// Fluxo B — a visita veio de um Orçamento já existente: já não há nada para
// criar, só um caminho de volta para o Admin rever/confirmar/ajustar esse
// mesmo Orçamento.
export function podeVoltarAoOrcamentoDaVisita(servico: {
  tipo: string;
  estado: string;
  budget_id?: string | null;
}): boolean {
  return eVisitaOrcamentoConcluida(servico) && !!servico.budget_id;
}

// PDF do Fecho (auditoria "Centralizar/PDF") — o documento (lib/pdf-fecho.ts)
// só passa a existir depois do Técnico fechar pelo menos uma vez como
// "concluido" (ver gerarPdfFechoSemBloquear em app/tecnico/actions.ts). Gate
// único, partilhado entre a ficha do Serviço e o PainelFaturacao — nunca
// duas versões deste critério.
const ESTADOS_COM_PDF_FECHO = ["aguarda_validacao", "correcao_necessaria", "concluido"] as const;

export function podeVerPdfFecho(servico: { estado: string }): boolean {
  return (ESTADOS_COM_PDF_FECHO as readonly string[]).includes(servico.estado);
}
