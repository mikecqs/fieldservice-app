export type NivelPreparacao = "preparada" | "info_falta" | "bloqueada";

// Onda 1: "emoji" (🟢🟠🔴) trocado por "dotColor", consumido por um ícone
// lucide-react (Circle preenchido) nos sítios que renderizam isto como JSX
// — mesma cor, sem depender de emoji. Nada na lógica de cálculo abaixo mudou.
export const PREPARACAO_BADGE: Record<NivelPreparacao, { dotColor: string; label: string; cls: string }> = {
  preparada: { dotColor: "text-emerald-400", label: "Preparada", cls: "bg-emerald-500/15 text-emerald-400" },
  info_falta: { dotColor: "text-amber-400", label: "Informação em falta", cls: "bg-amber-500/15 text-amber-400" },
  bloqueada: { dotColor: "text-red-400", label: "Bloqueada", cls: "bg-red-500/15 text-red-400" },
};

// Indicação puramente operacional — nunca impede o Admin de agendar ou
// alterar o serviço, é só um sinal visual de "está pronto para o técnico
// ir a isto?". "bloqueada" = falta algo que impede fisicamente o trabalho
// (sem técnico, sem morada, sem contacto, material ainda não chegou).
// "info_falta" = falta informação secundária (sem data/hora, descrição
// pouco detalhada).
export function calcularPreparacao(input: {
  temTecnico: boolean;
  morada: string | null | undefined;
  temContacto: boolean;
  descricao: string | null | undefined;
  dataAgendada: string | null | undefined;
  horaAgendada: string | null | undefined;
  materialBloqueando: boolean;
}): { nivel: NivelPreparacao; motivos: string[] } {
  const motivosBloqueio: string[] = [];
  const motivosInfo: string[] = [];

  if (!input.temTecnico) motivosBloqueio.push("sem técnico atribuído");
  if (!input.morada) motivosBloqueio.push("sem morada");
  if (!input.temContacto) motivosBloqueio.push("sem contacto do cliente");
  if (input.materialBloqueando) motivosBloqueio.push("material em falta");

  if (!input.dataAgendada || !input.horaAgendada) motivosInfo.push("sem data/hora agendada");
  if (!input.descricao || input.descricao.trim().length < 5) motivosInfo.push("descrição insuficiente");

  if (motivosBloqueio.length > 0) return { nivel: "bloqueada", motivos: motivosBloqueio };
  if (motivosInfo.length > 0) return { nivel: "info_falta", motivos: motivosInfo };
  return { nivel: "preparada", motivos: [] };
}
