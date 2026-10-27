// Configuração dos testes (vitest). Fica em .mts de propósito: fora do
// "include" do tsconfig, para o `next build` não exigir o vitest instalado.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["lib/__tests__/**/*.test.ts"], environment: "node" },
});
