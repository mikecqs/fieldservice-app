import type { HTMLAttributes } from "react";

// Mesmo cartão "rounded-xl border border-neutral-800 bg-neutral-900"
// repetido em 27 ficheiros (ver auditoria Onda 1) — nomeado aqui, mas só
// adotado nesta onda nos novos ecrãs de loading (composição nova, sem
// nenhum ficheiro existente a reescrever). Fica disponível para adoção
// progressiva depois, sem migração em massa agora.
const PADDING_CLASS = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: keyof typeof PADDING_CLASS;
};

export function Card({ padding = "lg", className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-neutral-800 bg-neutral-900 ${PADDING_CLASS[padding]} ${className}`}
      {...props}
    />
  );
}
