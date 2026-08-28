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
  rascunho: "bg-slate-100 text-slate-600",
  enviado: "bg-sky-100 text-sky-800",
  aguarda_resposta: "bg-amber-100 text-amber-800",
  followup: "bg-orange-100 text-orange-800",
  aceite: "bg-emerald-100 text-emerald-800",
  recusado: "bg-red-100 text-red-800",
  cancelado: "bg-slate-100 text-slate-500",
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
    return { label: SERVICO_LABEL[service.estado] ?? service.estado, cls: SERVICO_COLOR[service.estado] ?? "bg-slate-100 text-slate-600" };
  }
  if (budget) {
    return { label: ORCAMENTO_LABEL[budget.estado] ?? budget.estado, cls: ORCAMENTO_COLOR[budget.estado] ?? "bg-slate-100 text-slate-600" };
  }
  if (pedido.estado === "arquivado") {
    return { label: "Arquivado", cls: "bg-slate-100 text-slate-500" };
  }
  if (pedido.info_falta) {
    return { label: "Informação em falta", cls: "bg-amber-100 text-amber-800" };
  }
  return { label: "Novo", cls: "bg-indigo-50 text-indigo-700" };
}
