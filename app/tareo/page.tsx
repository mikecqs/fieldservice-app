import type { Metadata } from "next";
import { Nav } from "@/components/tareo/Nav";
import { TareoBackground } from "@/components/tareo/TareoBackground";
import { Hero } from "@/components/tareo/Hero";
import { Intro } from "@/components/tareo/Intro";
import { Produtos } from "@/components/tareo/Produtos";
import { ComoPensamos } from "@/components/tareo/ComoPensamos";
import { Visao } from "@/components/tareo/Visao";
import { ContactoCta } from "@/components/tareo/ContactoCta";
import { TareoFooter } from "@/components/tareo/TareoFooter";

// Landing institucional da Tareo (empresa-mãe) — página privada, partilhada
// só por link direto. Nunca ligada a partir de nenhum menu/sidebar da app
// (admin/atendimento/financeiro/tecnico/super-admin), e excluída do portão
// de sessão do middleware (ver middleware.ts) precisamente para poder ser
// aberta sem login. `robots: noindex, nofollow` mantém-na fora de motores
// de busca enquanto estiver em modo privado.
export const metadata: Metadata = {
  title: "Tareo — Software que simplifica negócios",
  description:
    "A Tareo cria produtos digitais simples e inteligentes para resolver problemas reais de empresas e profissionais.",
  // Sem isto, esta página herdava o manifest.json da nexIA (name: "nexIA",
  // start_url: "/tecnico") definido no layout raiz — visível se alguém
  // tentasse "adicionar ao ecrã principal" a partir daqui.
  manifest: undefined,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  openGraph: {
    title: "Tareo — Software que simplifica negócios",
    description:
      "A Tareo cria produtos digitais simples e inteligentes para resolver problemas reais de empresas e profissionais.",
    type: "website",
  },
};

export default function TareoPage() {
  return (
    <div className="bg-surface-base text-white">
      <TareoBackground />
      <Nav />
      <main>
        <Hero />
        <Intro />
        <Produtos />
        <ComoPensamos />
        <Visao />
        <ContactoCta />
      </main>
      <TareoFooter />
    </div>
  );
}
