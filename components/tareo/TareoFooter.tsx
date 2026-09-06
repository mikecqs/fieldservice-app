import { TareoWordmark } from "./TareoWordmark";

const LINKS = [
  { href: "#produtos", label: "Produtos" },
  { href: "#visao", label: "Sobre" },
  { href: "#contacto", label: "Contacto" },
];

// "Política de Privacidade" e "Termos" ainda não existem como páginas
// reais — ficam listados (o pedido pede a estrutura) mas sem link, com uma
// etiqueta discreta, em vez de apontar para uma rota inventada.
const LINKS_PENDENTES = ["Política de Privacidade", "Termos"];

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
          {LINKS_PENDENTES.map((label) => (
            <span key={label} className="text-sm text-muted-foreground/60">
              {label}
            </span>
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
