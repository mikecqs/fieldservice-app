// Textura subtil e persistente (grelha de pontos) por cima de toda a
// página — a mesma técnica usada por sites SaaS minimalistas premium
// (Linear, Vercel) para o preto não ficar completamente vazio entre
// secções. Sobreposta (z-index alto, `pointer-events-none`) em vez de
// pintada por trás, para não desaparecer atrás de secções com fundo
// próprio (ex: Visao usa `bg-surface`) — assim fica sempre visível e
// consistente do topo ao fundo da página, independentemente do que está
// por baixo. Primeira versão (opacidade 0.06) era imperceptível a olho
// nu em ecrã normal — confirmado presente no HTML/CSS de produção, só
// mesmo demasiado subtil; 0.11 é o ponto em que se nota sem competir
// com o texto.
export function TareoBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.11) 1.5px, transparent 1.5px)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}
