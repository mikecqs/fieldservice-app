const emDesenvolvimento = process.env.NODE_ENV !== "production";

// CSP construída a partir do que a app realmente usa (auditado no código,
// não copiada de um exemplo genérico):
// - script-src/style-src 'self': todo o JS/CSS vem do próprio bundle
//   Next.js, nada externo (sem Google Fonts, sem analytics, sem CDN).
// - style-src precisa de 'unsafe-inline': o React (e em particular o
//   recharts, usado no Dashboard) define muito estilo via `style={{...}}`,
//   que sai para HTML como atributo `style=""` — sujeito a style-src.
//   script-src fica estrito na mesma (sem 'unsafe-inline'/'unsafe-eval' em
//   produção) — é ali que uma CSP importa mesmo contra XSS.
// - img-src inclui o domínio do Supabase Storage: o logotipo da empresa
//   (LogoForm.tsx) é servido através de um signed URL para
//   https://<projeto>.supabase.co/storage/v1/... .
// - connect-src fica só 'self': confirmado por grep que nenhum componente
//   "use client" importa o cliente browser do Supabase
//   (lib/supabase/client.ts não é usado em lado nenhum hoje) — toda a
//   leitura/escrita passa por Server Actions/Server Components, ou seja,
//   o browser nunca fala diretamente com *.supabase.co.
// - Em desenvolvimento (`next dev`) o Fast Refresh do Next precisa de
//   'unsafe-eval' em script-src e de um websocket para localhost em
//   connect-src — adicionado só quando NODE_ENV !== "production", nunca
//   em produção.
function contentSecurityPolicy() {
  const scriptSrc = emDesenvolvimento ? "'self' 'unsafe-eval'" : "'self'";
  const connectSrc = emDesenvolvimento ? "'self' ws://localhost:* http://localhost:*" : "'self'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://*.supabase.co",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silencia o aviso de "múltiplos lockfiles" do Next — este projeto tem o
  // seu próprio package-lock.json, independente do do repo na raiz.
  outputFileTracingRoot: import.meta.dirname,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          // Redundante com frame-ancestors da CSP acima, mas mantido para
          // browsers/crawlers mais antigos que não suportam CSP.
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
