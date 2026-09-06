import { Reveal } from "./Reveal";

export function Visao() {
  return (
    <section id="visao" className="border-t border-edge/60 bg-surface px-6 py-28">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Estamos a construir uma nova geração de software empresarial.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted">
            A Tareo nasce com uma ideia simples: empresas melhores precisam
            de ferramentas melhores. Estamos a criar um portfólio de
            produtos digitais especializados, cada um pensado para resolver
            um problema concreto.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
