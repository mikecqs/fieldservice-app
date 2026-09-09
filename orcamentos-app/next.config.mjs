/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silencia o aviso de "múltiplos lockfiles" do Next — este projeto tem o
  // seu próprio package-lock.json, independente do do repo na raiz.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
