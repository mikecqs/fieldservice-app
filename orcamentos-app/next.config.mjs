/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silencia o aviso de "múltiplos lockfiles" do Next — este projeto tem o
  // seu próprio package-lock.json, independente do do repo na raiz.
  outputFileTracingRoot: import.meta.dirname,

  // Content-Security-Policy fica em middleware.ts, não aqui — precisa de
  // um nonce por pedido para os scripts inline que o próprio Next.js
  // injeta (payload de RSC), e só o middleware permite isso (ver
  // comentário em middleware.ts). Os headers abaixo não dependem de nada
  // por pedido, por isso continuam bem aqui.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Redundante com frame-ancestors da CSP em middleware.ts, mas
          // mantido para browsers/crawlers mais antigos que não suportam CSP.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
