import { Card } from "@/components/ui/Card";

// Relatórios agrega várias queries em paralelo (ver getFinanceiroStats,
// getPontosAtencao, getEvolucao, etc.) — é o ecrã com mais latência
// combinada da app, por isso é o candidato mais óbvio a skeleton.
export default function RelatoriosLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-md bg-neutral-900" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="sm" className="animate-pulse">
            <div className="h-3 w-2/3 rounded bg-neutral-800" />
            <div className="mt-2 h-5 w-1/2 rounded bg-neutral-800" />
          </Card>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="h-32 animate-pulse" />
      ))}
    </div>
  );
}
