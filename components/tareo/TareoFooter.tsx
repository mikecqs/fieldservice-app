import { TareoWordmark } from "./TareoWordmark";

// Rodapé partilhado por /tareo, /contacto, /privacidade e /termos — por
// isso "Produtos"/"Sobre" usam sempre o caminho completo para a landing
// (funcionam também quando o rodapé aparece numa página que não tem esses
// elementos na própria página).
const LINKS = [
  { href: "/tareo#produtos", label: "Produtos" },
  { href: "/tareo#visao", label: "Sobre" },
  { href: "/contacto", label: "Contacto" },
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos", label: "Termos" },
];

export function TareoFooter() {
  return (
    <footer className="border-t border-edge/60 px-6 py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <TareoWordmark className="text-base" />
          <p className="mt-2 text-sm text-muted-foreground">
            Software que simplifica negócios.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-edge/60 pt-6">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Tareo
        </p>
      </div>
    </footer>
  );
}
