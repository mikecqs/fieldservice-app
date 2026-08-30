import type { Config } from "tailwindcss";

// Onda 1 — Fundação Premium: tokens semânticos que APONTAM para as cores
// que a app já usa em todo o lado (neutral-900/800/950, amber/emerald/red/
// sky a 500/15). Isto é só um passo de "nomear o que já existe" — nenhum
// valor visual muda, nenhuma classe existente (bg-neutral-900, etc.) deixa
// de funcionar. Só components/ui/* consome estes nomes novos para já;
// o resto da app continua a usar as classes neutral-* diretamente, para não
// obrigar a uma migração em massa (ver CLAUDE.md, Onda 1).
//
// Convenção de cor de estado já em uso (documentada aqui, não renomeada):
// âmbar = atenção/pendente, esmeralda = sucesso, vermelho = perigo/rejeitado,
// azul (sky) = agendado/informativo, laranja = aviso secundário.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Valores literais (não `theme("colors.neutral.900")`) de propósito:
      // resolver `theme()` de dentro de theme.extend.colors entra em
      // recursão infinita nesta versão do Tailwind. Estes hex SÃO
      // exatamente os neutral-900/800/950/700/400/500 default do Tailwind
      // — zero mudança de valor, só o nome novo.
      colors: {
        surface: {
          base: "#0a0a0a", // neutral-950
          DEFAULT: "#171717", // neutral-900
          raised: "#262626", // neutral-800
        },
        // Chamado "edge" (não "border") de propósito — nomear uma cor
        // "border" colidiu com o utilitário nativo `border-*` do Tailwind
        // e partiu o build (selector parser) combinado com a sintaxe de
        // opacidade "/15" já usada em todo o resto da app.
        edge: {
          DEFAULT: "#262626", // neutral-800
          subtle: "#404040", // neutral-700
        },
        muted: {
          DEFAULT: "#a3a3a3", // neutral-400
          foreground: "#737373", // neutral-500
        },
      },
    },
  },
  plugins: [],
};
export default config;
