import { TareoWordmark } from "./TareoWordmark";

const LINKS = [
  { href: "#produtos", label: "Produtos" },
  { href: "#como-pensamos", label: "Como pensamos" },
  { href: "#visao", label: "Visão" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-edge/60 bg-surface-base/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-lg">
          <TareoWordmark />
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="#contacto"
          className="rounded-md border border-edge-subtle px-3.5 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
        >
          Falar connosco
        </a>
      </div>
    </header>
  );
}
