import { produtos } from "./produtos-data";
import { ProductCard } from "./ProductCard";
import { Reveal } from "./Reveal";

export function Produtos() {
  return (
    <section id="produtos" className="border-t border-edge/60 px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Produtos Tareo
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-4 text-balance text-lg text-muted">
              Ferramentas criadas para resolver problemas reais.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {produtos.map((produto, i) => (
            <Reveal key={produto.numero} delay={i * 100}>
              <ProductCard produto={produto} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
