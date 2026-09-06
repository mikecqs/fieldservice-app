// Sem logo definitivo ainda: uma apresentação textual elegante do nome,
// isolada num único componente para que, quando existir um SVG oficial,
// baste substituir o conteúdo aqui — nenhum outro ficheiro precisa de
// mudar. Deliberadamente sem ícone/monograma (evitar inventar uma
// identidade visual complexa antes de haver logo).
export function TareoWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-white ${className}`}>
      Tareo
    </span>
  );
}
