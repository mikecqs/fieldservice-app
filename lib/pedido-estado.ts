import { ESTADO_LABEL as SERVICO_LABEL, ESTADO_COLOR as SERVICO_COLOR } from "@/app/admin/servicos/estados";
// Onda 4 (Etapa 12) — só a COR do estado do Orçamento vem agora de uma
// fonte partilhada com app/admin/orcamentos/page.tsx e
// app/admin/orcamentos/[id]/page.tsx (nunca divergem entre si). O LABEL
// abaixo (ORCAMENTO_LABEL) fica deliberadamente à parte: é o texto
// contextual mostrado dentro do percurso do Pedido (ex: "Em orçamento
// (rascunho)"), diferente do label "neutro" usado no resto da app — nunca
// fundir os dois.
import { ESTADO_COLOR as ORCAMENTO_COLOR, ESTADO_COLOR_FALLBACK } from "@/lib/orcamento-visual";
import { TIPO_VISITA_ORCAMENTO } from "@/lib/servico-estado";

// Onda 4 (Etapa 14) — fonte única do label do estado bruto do Pedido
// (requests.estado), antes duplicado em PedidoDetalheConteudo.tsx e
// PedidosCompactos.tsx. Diferente de estadoOperacionalPedido() abaixo, que
// deriva um estado operacional a partir do orçamento/serviço associado —
// este é só a tradução direta do valor de requests.estado.
export const ESTADO_PEDIDO_LABEL: Record<string, string> = {
  novo: "Novo",
  orcamento: "Em orçamento",
  convertido: "Convertido em serviço",
  arquivado: "Arquivado",
};

const ORCAMENTO_LABEL: Record<string, string> = {
  rascunho: "Em orçamento (rascunho)",
  enviado: "Orçamento enviado",
  aguarda_resposta: "Aguarda resposta do cliente",
  followup: "Aguarda resposta (follow-up)",
  aceite: "Orçamento aceite",
  recusado: "Orçamento recusado",
  cancelado: "Orçamento cancelado",
};

// Agrupamento operacional para as listas de Pedidos (Admin e ATENDIMENTO) —
// única fonte de verdade, calculada sempre na MESMA passagem que o rótulo
// abaixo (nunca uma segunda leitura em separado de requests.estado, que é
// só um estado grosseiro do pedido em si e nunca reflete o progresso real
// do Orçamento/Serviço ligado a ele: fica em 'orcamento' para sempre depois
// de criado o orçamento, mesmo já o Serviço resultante estando concluído;
// e passa a 'convertido' logo que o Serviço é criado, mesmo ainda por
// agendar). Duas listas (PedidosLista.tsx e app/atendimento/pedidos/
// page.tsx) já tinham cada uma a sua própria regra de agrupamento shallow
// baseada em requests.estado, que divergia deste rótulo — corrigido para
// as duas usarem sempre este único campo.
export type GrupoPedido = "acao" | "andamento" | "concluido";

const SERVICO_ESTADOS_CONCLUIDOS = new Set(["concluido", "cancelado", "nao_realizado"]);
const ORCAMENTO_ESTADOS_CONCLUIDOS = new Set(["recusado", "cancelado"]);

// "Data do estado atual" — a data-hora do ÚLTIMO evento (service_events/
// budget_events) da entidade que decide o rótulo/grupo acima (nunca uma
// segunda leitura independente): como o histórico é sempre aditivo e cada
// transição regista sempre um evento, o evento mais recente da entidade É,
// por definição, o momento em que ela entrou no estado atual — por isso
// esta data atualiza sozinha sempre que o pedido muda de estado, sem
// precisar de nenhuma coluna "atualizado_em". `ultimoEventoEm` é opcional
// e calculado à parte (fora desta função pura, que não faz queries) só
// pelos chamadores que já têm acesso a service_events/budget_events — ver
// app/admin/pedidos/page.tsx. Sem isso (ex: ATENDIMENTO, que não tem
// policy nenhuma nessas tabelas — ver secção 4 do CLAUDE.md), cai sempre
// no fallback `pedido.created_at`.

// Estado operacional REAL de um pedido — nunca um valor novo gravado na BD,
// só a leitura, por esta ordem de prioridade, do que já existe em
// budgets/services (que são a fonte da verdade de cada etapa). Assim o
// pedido reflete sempre a situação atual sem duplicar estado nenhures.
//
// `services` é uma LISTA, não um único Serviço — a Visita Prévia tornou
// normal um Pedido ter mais do que um Serviço ligado ao longo do tempo
// (Visita Prévia → Serviço de Instalação, por exemplo). Isto é só o
// resumo operacional para um badge (um valor só); a página do Pedido
// mostra a lista completa sem esconder nada (ver PedidoDetalheConteudo.tsx)
// — aqui a prioridade é sempre por TIPO de Serviço, nunca por "o mais
// recente": um Serviço "real" (qualquer tipo que não seja Visita Prévia)
// reflete sempre o estado atual do trabalho e tem prioridade sobre uma
// Visita Prévia já resolvida; só na ausência de um Serviço real é que o
// Orçamento, e depois a própria Visita Prévia, decidem o rótulo.
export function estadoOperacionalPedido(
  pedido: { estado: string; info_falta: boolean; created_at?: string },
  budget: { estado: string; ultimoEventoEm?: string | null } | undefined,
  services: { estado: string; tipo?: string; ultimoEventoEm?: string | null }[]
): { label: string; cls: string; grupo: GrupoPedido; data: string | null } {
  // 'info_falta' pede sempre ação, seja qual for o progresso já feito a
  // jusante (mesmo caso arquivado/concluído) — só o AGRUPAMENTO é forçado
  // para "acao", o rótulo continua sempre a refletir o progresso real.
  const grupo = (g: GrupoPedido): GrupoPedido => (pedido.info_falta ? "acao" : g);
  const fallback = pedido.created_at ?? null;

  const servicoReal = services.find((s) => s.tipo !== TIPO_VISITA_ORCAMENTO);
  if (servicoReal) {
    return {
      label: SERVICO_LABEL[servicoReal.estado] ?? servicoReal.estado,
      cls: SERVICO_COLOR[servicoReal.estado] ?? "bg-neutral-800 text-neutral-300",
      grupo: grupo(SERVICO_ESTADOS_CONCLUIDOS.has(servicoReal.estado) ? "concluido" : "andamento"),
      data: servicoReal.ultimoEventoEm ?? fallback,
    };
  }
  if (budget) {
    return {
      label: ORCAMENTO_LABEL[budget.estado] ?? budget.estado,
      cls: ORCAMENTO_COLOR[budget.estado] ?? "bg-neutral-800 text-neutral-300",
      grupo: grupo(ORCAMENTO_ESTADOS_CONCLUIDOS.has(budget.estado) ? "concluido" : "andamento"),
      data: budget.ultimoEventoEm ?? fallback,
    };
  }
  const visita = services[0];
  if (visita) {
    return {
      label: SERVICO_LABEL[visita.estado] ?? visita.estado,
      cls: SERVICO_COLOR[visita.estado] ?? "bg-neutral-800 text-neutral-300",
      grupo: grupo(SERVICO_ESTADOS_CONCLUIDOS.has(visita.estado) ? "concluido" : "andamento"),
      data: visita.ultimoEventoEm ?? fallback,
    };
  }
  if (pedido.estado === "arquivado") {
    // Sem histórico de eventos ao nível do Pedido (arquivarPedido não
    // regista nenhum) — fallback é sempre a data de criação, aproximada.
    return { label: "Arquivado", cls: "bg-neutral-800 text-neutral-400", grupo: grupo("concluido"), data: fallback };
  }
  if (pedido.info_falta) {
    return { label: "Informação em falta", cls: "bg-amber-500/15 text-amber-400", grupo: "acao", data: fallback };
  }
  return { label: "Novo", cls: "bg-neutral-800 text-neutral-200", grupo: "acao", data: fallback };
}

// Um pedido só pode ser decidido (arquivado, ou convertido em orçamento/
// serviço) enquanto ainda estiver 'novo' — depois de já ter seguido para
// orçamento ou serviço, repetir a ação criaria um orçamento/serviço órfão
// duplicado (mesma classe de problema já corrigida no BLOCO 6 para
// orçamentos aceites duas vezes). Mesmo espírito de lib/servico-estado.ts,
// lib/orcamento-estado.ts e lib/compra-estado.ts.
export function podeDecidirPedido(pedido: { estado: string }): boolean {
  return pedido.estado === "novo";
}
