import { Reveal } from "./Reveal";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-6 pb-28 pt-24 md:pt-36">
      {/* Glow monocromático muito subtil — não é um "gradiente colorido",
          só um respiro de luz atrás do título, consistente com o pedido
          de evitar excesso de gradientes/glassmorphism. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-3xl"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <Reveal>
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Tareo
          </span>
        </Reveal>

        <Reveal delay={100}>
          <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl">
            Software que simplifica negócios.
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted md:text-xl">
            Criamos produtos digitais simples, inteligentes e focados em
            problemas reais de empresas e profissionais.
          </p>
        </Reveal>

        <Reveal delay={300}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="#produtos"
              className="rounded-md bg-white px-6 py-3 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200"
            >
              Conhecer os produtos
            </a>
            <a
              href="#contacto"
              className="rounded-md border border-edge-subtle px-6 py-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
            >
              Falar connosco
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
