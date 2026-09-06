import type { Metadata } from "next";
import { LegalHeader } from "@/components/tareo/LegalHeader";
import { ContactoCta } from "@/components/tareo/ContactoCta";
import { TareoFooter } from "@/components/tareo/TareoFooter";

// Página institucional partilhada entre a Tareo e o Serv (ver CLAUDE.md
// secção 12) — acessível a partir de tareo.pt e de serv.tareo.pt sem
// sessão. Reutiliza o mesmo ContactoCta da landing (nunca duplica o botão
// de contacto nem a lógica do placeholder).
export const metadata: Metadata = {
  title: "Contacto — Tareo",
  description: "Como contactar a Tareo.",
  manifest: undefined,
  robots: { index: false, follow: false, nocache: true },
};

export default function ContactoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-white">
      <LegalHeader />
      <main className="flex-1">
        <ContactoCta />
      </main>
      <TareoFooter />
    </div>
  );
}
