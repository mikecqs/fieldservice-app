import { forwardRef, type ButtonHTMLAttributes } from "react";

// Classes idênticas às já usadas em toda a app (ver auditoria Onda 1 —
// mesma string repetida em 33 ficheiros para "primary"): este componente só
// nomeia o que já existe, não introduz nenhum visual novo. Adotado nesta
// onda só nos botões de fechar popup (ServicoModal/PedidoModal/
// ServicosPopup) — o resto da app continua com as classes inline, para não
// forçar uma migração em massa só para "usar componentes".
const VARIANT_CLASS = {
  primary: "bg-white text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "border border-neutral-700 text-neutral-200 hover:bg-neutral-800",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-neutral-400 hover:bg-neutral-800",
} as const;

const SIZE_CLASS = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  // Mesmo padding/tamanho já usado nos botões "Fechar" dos popups.
  icon: "px-2 py-1 text-sm",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT_CLASS;
  size?: keyof typeof SIZE_CLASS;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`rounded-md font-medium ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  );
});
