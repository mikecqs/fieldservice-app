import { ESTADO_LABEL, ESTADO_COLOR } from "@/app/admin/servicos/estados";

// Fonte única de cor/rótulo de estado de Serviço continua a ser
// app/admin/servicos/estados.ts (ver CLAUDE.md) — este componente só lê de
// lá, nunca duplica o mapa. Usar `estado` sempre que fores mostrar o estado
// de um Serviço (é o que elimina as cópias que existiam no Técnico); usar
// `tone` para qualquer outro badge ad-hoc (ex: "Falta info", "Hoje") que já
// seguia a mesma linguagem visual (bg-*-500/15 text-*-400) mas sem estado
// de serviço nenhum por trás.
const TONE_CLASS: Record<string, string> = {
  neutral: "bg-neutral-800 text-neutral-300",
  attention: "bg-amber-500/15 text-amber-400",
  success: "bg-emerald-500/15 text-emerald-400",
  danger: "bg-red-500/15 text-red-400",
  info: "bg-sky-500/15 text-sky-400",
};

type BadgeProps = {
  className?: string;
} & (
  | { estado: string; tone?: never; children?: never }
  | { tone?: keyof typeof TONE_CLASS; estado?: never; children: React.ReactNode }
);

export function Badge({ className = "", ...props }: BadgeProps) {
  const cls =
    "estado" in props && props.estado !== undefined
      ? ESTADO_COLOR[props.estado] ?? TONE_CLASS.neutral
      : TONE_CLASS[props.tone ?? "neutral"];
  const label = "estado" in props && props.estado !== undefined ? ESTADO_LABEL[props.estado] ?? props.estado : props.children;

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls} ${className}`}>{label}</span>;
}
