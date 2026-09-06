// Marca Tareo: "T" geométrico cuja haste termina num ponto — o técnico a
// chegar a uma morada. Mesma linguagem visual (barras sólidas, sem
// gradientes/serifas) da marca anterior; único elemento a cores é o ponto.
export function TareoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
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
