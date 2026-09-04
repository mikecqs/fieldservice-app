/** @type {import('next').NextConfig} */

// Auditoria de superfície de ataque — cabeçalhos de segurança que faltavam
// por completo (ficheiro estava vazio). CSP deliberadamente permissiva em
// script-src/style-src ('unsafe-inline'/'unsafe-eval') porque esta app não
// tem infraestrutura de nonce por pedido — mesmo assim já bloqueia a classe
// de ataque mais comum (injetar/carregar um script de outro domínio) e o
// clickjacking (frame-ancestors). connect-src/img-src incluem
// *.supabase.co (API + Storage + Realtime); img-src inclui blob:/data: para
// pré-visualizações locais de fotos antes do upload (ex: fecho de visita do
// Técnico). TESTAR NO BROWSER depois do deploy — uma CSP demasiado
// restritiva falha em silêncio (só a consola do browser mostra o aviso de
// bloqueio), nunca partiu build/tsc.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  // Deixa de expor "X-Powered-By: Next.js" nas respostas (info disclosure
  // gratuita sobre a framework usada).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
