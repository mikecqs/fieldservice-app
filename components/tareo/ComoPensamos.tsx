import { Reveal } from "./Reveal";

const PRINCIPIOS = [
  {
    titulo: "Construímos para resolver.",
    texto:
      "Não criamos software apenas porque podemos. Criamos produtos quando existe um problema real que pode ser resolvido de forma mais simples.",
  },
  {
    titulo: "Simplicidade primeiro.",
    texto: "Software poderoso não precisa de ser complicado.",
  },
  {
    titulo: "Feito para ser utilizado.",
    texto:
      "Os nossos produtos devem ser intuitivos, rápidos e úteis desde o primeiro dia.",
  },
  {
    titulo: "Tecnologia com propósito.",
    texto:
      "Usamos tecnologia para eliminar complexidade, automatizar trabalho e criar novas possibilidades.",
  },
];

export function ComoPensamos() {
  return (
    <section id="como-pensamos" className="border-t border-edge/60 px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Como pensamos
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
          {PRINCIPIOS.map((principio, i) => (
            <Reveal key={principio.titulo} delay={i * 80}>
              <div className="border-l border-edge-subtle pl-6">
                <h3 className="text-lg font-medium text-white">
                  {principio.titulo}
                </h3>
                <p className="mt-2 leading-relaxed text-muted">
                  {principio.texto}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
