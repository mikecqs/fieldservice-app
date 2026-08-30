// Mesma frase-tipo ("Ainda sem...", "Nada...", "Sem...") repetida em texto
// centrado cinzento por toda a app — nomeada aqui para os sítios que já
// estão a ser tocados nesta onda; não é uma migração dos restantes.
export function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return <p className={`text-center text-sm text-neutral-500 ${compact ? "py-4" : "py-10"}`}>{message}</p>;
}
