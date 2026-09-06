import type { Produto } from "./produtos-data";

export function ProductCard({ produto }: { produto: Produto }) {
  return (
    <div className="group flex h-full flex-col rounded-2xl border border-edge bg-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:border-edge-subtle">
      <span className="text-sm font-medium text-muted-foreground">
        Produto {produto.numero}
      </span>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
        {produto.nome}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {produto.descricao}
      </p>

      {produto.features && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {produto.features.map((feature) => (
            <li
              key={feature}
              className="rounded-full border border-edge px-2.5 py-1 text-xs text-muted"
            >
              {feature}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-7 pt-1">
        {produto.href ? (
          <a
            href={produto.href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors group-hover:text-neutral-200"
          >
            {produto.cta}
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            {produto.cta}
            <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-muted-foreground">
              Em breve
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
