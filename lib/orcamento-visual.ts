// Onda 4 (Etapa 12) — fonte única da representação visual do estado do
// Orçamento (rascunho/enviado/aguarda_resposta/followup/aceite/recusado/
// cancelado). Valores copiados tal e qual de app/admin/orcamentos/page.tsx,
// sem inventar nem alterar nenhuma cor.
//
// Só as CORES são verdadeiramente partilhadas por todos os sítios que
// mostram o estado do Orçamento. O LABEL aqui é o "neutro" (usado na lista
// e na ficha do próprio orçamento) — lib/pedido-estado.ts mantém o seu
// próprio ORCAMENTO_LABEL, com frases deliberadamente contextuais (ex: "Em
// orçamento (rascunho)", para quando o orçamento aparece dentro do percurso
// de um Pedido) — nunca fundir os dois textos num só.
export const ESTADO_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aguarda_resposta: "Aguarda resposta",
  followup: "Follow-up",
  aceite: "Aceite",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

export const ESTADO_COLOR: Record<string, string> = {
  rascunho: "bg-neutral-800 text-neutral-300",
  enviado: "bg-sky-500/15 text-sky-400",
  aguarda_resposta: "bg-amber-500/15 text-amber-400",
  followup: "bg-orange-500/15 text-orange-400",
  aceite: "bg-emerald-500/15 text-emerald-400",
  recusado: "bg-red-500/15 text-red-400",
  cancelado: "bg-neutral-800 text-neutral-400",
};

// Fallback seguro para um estado inesperado — mesmo comportamento que os
// três sítios já tinham individualmente antes desta etapa (mostrar o
// próprio valor como label, com uma cor neutra), nunca esconder nem inventar
// um estado novo.
export const ESTADO_COLOR_FALLBACK = "bg-neutral-800 text-neutral-300";
