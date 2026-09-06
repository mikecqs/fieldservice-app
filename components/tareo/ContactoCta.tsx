"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";

// Ainda não existe nenhum canal de contacto oficial da Tareo (email,
// formulário, telefone) — em vez de inventar um, o botão revela uma nota
// preparada para ser substituída assim que existir um destino real
// (mailto/form/link), sem nenhum link morto nem dado fabricado.
export function ContactoCta() {
  const [revelado, setRevelado] = useState(false);

  return (
    <section id="contacto" className="border-t border-edge/60 px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Tem um problema que o software pode resolver?
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted">
            Estamos sempre à procura de novos problemas para transformar em
            produtos simples e úteis.
          </p>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-10">
            {revelado ? (
              <p className="text-sm text-muted-foreground">
                Estamos a preparar os canais de contacto oficiais da Tareo.
                Volta em breve.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setRevelado(true)}
                className="rounded-md bg-white px-6 py-3 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200"
              >
                Falar com a Tareo
              </button>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
