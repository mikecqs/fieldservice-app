import { ESTADO_LABEL as SERVICO_LABEL, ESTADO_COLOR as SERVICO_COLOR } from "@/app/admin/servicos/estados";

const ORCAMENTO_LABEL: Record<string, string> = {
  rascunho: "Em orçamento (rascunho)",
  enviado: "Orçamento enviado",
  aguarda_resposta: "Aguarda resposta do cliente",
  followup: "Aguarda resposta (follow-up)",
  aceite: "Orçamento aceite",
  recusado: "Orçamento recusado",
  cancelado: "Orçamento cancelado",
};

const ORCAMENTO_COLOR: Record<string, string> = {
  rascunho: "bg-neutral-800 text-neutral-300",
  enviado: "bg-sky-500/15 text-sky-400",
  aguarda_resposta: "bg-amber-500/15 text-amber-400",
  followup: "bg-orange-500/15 text-orange-400",
  aceite: "bg-emerald-500/15 text-emerald-400",
  recusado: "bg-red-500/15 text-red-400",
  cancelado: "bg-neutral-800 text-neutral-400",
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
