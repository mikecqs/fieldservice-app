import { Reveal } from "./Reveal";

export function Intro() {
  return (
    <section className="border-t border-edge/60 px-6 py-28">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Menos complexidade. Mais trabalho feito.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted">
            Acreditamos que o software empresarial não precisa de ser
            complicado. Criamos ferramentas focadas, rápidas e fáceis de
            utilizar, pensadas para resolver problemas concretos do dia a
            dia. Queremos transformar processos complexos em experiências
            simples.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
