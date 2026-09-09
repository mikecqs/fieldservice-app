import type { Config } from "tailwindcss";

// Tokens semânticos alinhados com o resto do ecossistema Tareo/Serv
// (mesmos valores literais de tailwind.config.ts na raiz do repo — ver
// esse ficheiro para o porquê de "edge" em vez de "border" e de valores
// literais em vez de theme("colors...")). Tema escuro monocromático,
// sem cor de marca (accent) — só preto/branco/cinza, como a landing da
// Tareo (components/tareo/*).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#0a0a0a", // neutral-950
          DEFAULT: "#171717", // neutral-900
          raised: "#262626", // neutral-800
        },
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
