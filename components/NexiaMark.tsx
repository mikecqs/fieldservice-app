// Marca nexIA: monograma "N" geométrico minimalista — evita o cliché do
// "cérebro de IA". Fundo branco + traço preto, consistente com a
// identidade principal (preto/branco/cinzentos) usada em toda a app.
export function NexiaMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" aria-hidden="true">
        <rect x="5" y="4" width="3.2" height="16" rx="0.8" fill="#0a0a0a" />
        <rect x="15.8" y="4" width="3.2" height="16" rx="0.8" fill="#0a0a0a" />
        <rect x="10.4" y="3.15" width="3.2" height="17.71" rx="0.8" fill="#0a0a0a" transform="rotate(25.4 12 12)" />
      </svg>
    </div>
  );
}
