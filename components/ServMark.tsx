// Marca do Serv (produto de gestão operacional, "by Tareo"): mesmo ícone
// geométrico já usado antes (barras sólidas + ponto colorido — o técnico a
// chegar a uma morada), só renomeado de TareoMark para ServMark porque
// "Tareo" passou a designar a empresa-mãe (ver app/tareo/page.tsx), não
// este produto. Forma do ícone propositadamente inalterada.
export function ServMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="3.4" rx="1.2" fill="#0a0a0a" />
        <rect x="10.3" y="5" width="3.4" height="12" rx="1.2" fill="#0a0a0a" />
        <circle cx="12" cy="19.4" r="3.4" fill="#2f9e8f" />
      </svg>
    </div>
  );
}
