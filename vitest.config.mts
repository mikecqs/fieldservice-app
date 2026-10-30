// Configuração dos testes (vitest). Objeto simples, sem `import from "vitest"`:
// o vitest corre via `npx` (não está no package.json/lockfile), por isso não
// pode ser resolvido a partir da pasta do projeto. Fica em .mts para o
// `next build`/tsc não o incluírem.
import { fileURLToPath } from "node:url";

export default {
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["lib/__tests__/**/*.test.ts"], environment: "node", globals: true },
};
