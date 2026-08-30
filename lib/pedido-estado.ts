import { ESTADO_LABEL as SERVICO_LABEL, ESTADO_COLOR as SERVICO_COLOR } from "@/app/admin/servicos/estados";
// Onda 4 (Etapa 12) — só a COR do estado do Orçamento vem agora de uma
// fonte partilhada com app/admin/orcamentos/page.tsx e
// app/admin/orcamentos/[id]/page.tsx (nunca divergem entre si). O LABEL
// abaixo (ORCAMENTO_LABEL) fica deliberadamente à parte: é o texto
// contextual mostrado dentro do percurso do Pedido (ex: "Em orçamento
// (rascunho)"), diferente do label "neutro" usado no resto da app — nunca
// fundir os dois.
import { ESTADO_COLOR as ORCAMENTO_COLOR, ESTADO_COLOR_FALLBACK } from "@/lib/orcamento-visual";

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

// Estado operacional REAL de um pedido — nunca um valor novo gravado na BD,
// só a leitura, por esta ordem de prioridade, do que já existe em
// budgets/services (que são a fonte da verdade de cada etapa). Assim o
// pedido reflete sempre a situação atual sem duplicar estado nenhures.
export function estadoOperacionalPedido(
  pedido: { estado: string; info_falta: boolean },
  budget: { estado: string } | undefined,
  service: { estado: string } | undefined
): { label: string; cls: string } {
  if (service) {
    return { label: SERVICO_LABEL[service.estado] ?? service.estado, cls: SERVICO_COLOR[service.estado] ?? "bg-neutral-800 text-neutral-300" };
  }
  if (budget) {
    return { label: ORCAMENTO_LABEL[budget.estado] ?? budget.estado, cls: ORCAMENTO_COLOR[budget.estado] ?? "bg-neutral-800 text-neutral-300" };
  }
  if (pedido.estado === "arquivado") {
    return { label: "Arquivado", cls: "bg-neutral-800 text-neutral-400" };
  }
  if (pedido.info_falta) {
    return { label: "Informação em falta", cls: "bg-amber-500/15 text-amber-400" };
  }
  return { label: "Novo", cls: "bg-neutral-800 text-neutral-200" };
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
