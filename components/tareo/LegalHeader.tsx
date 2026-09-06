import Link from "next/link";
import { TareoWordmark } from "./TareoWordmark";

// Cabeçalho leve partilhado por /contacto, /privacidade e /termos — páginas
// institucionais acessíveis a partir de tareo.pt e de serv.tareo.pt (ver
// CLAUDE.md secção 12), por isso "Voltar" aponta sempre para a landing da
// Tareo, nunca para a app.
export function LegalHeader() {
  return (
    <header className="border-b border-edge/60 bg-surface-base/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
        <Link href="/tareo" className="text-lg">
          <TareoWordmark />
        </Link>
        <Link href="/tareo" className="text-sm text-muted transition-colors hover:text-white">
          ← Voltar
        </Link>
      </div>
    </header>
  );
}
