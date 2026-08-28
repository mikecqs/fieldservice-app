import { createClient } from "@/lib/supabase/server";

const EVENTO_LABEL: Record<string, string> = {
  validado: "Validado",
  correcao_pedida: "Correção pedida",
  faturado: "Faturado",
};

// Histórico financeiro: só os eventos do pipeline de faturação (validação,
// correção, faturação) — não o histórico operacional completo (esse é só
// para Admin, em /admin/servicos/[id]).
export default async function HistoricoFinanceiroPage() {
  const supabase = createClient();

  const { data: eventos } = await supabase
    .from("service_events")
    .select("tipo, descricao, created_at, services(descricao, clients(nome)), profiles(nome)")
    .in("tipo", ["validado", "correcao_pedida", "faturado"])
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Histórico financeiro</h1>
        <p className="mt-0.5 text-sm text-neutral-400">Validações, correções e faturações mais recentes.</p>
      </div>

      <div className="space-y-2">
        {(eventos ?? []).map((e: any, i: number) => (
          <div key={i} className="rounded-md border border-neutral-800 bg-neutral-900 p-3.5 text-sm">
            <div className="mb-1 flex justify-between text-xs text-neutral-400">
              <span className="font-semibold text-neutral-200">
                {EVENTO_LABEL[e.tipo] ?? e.tipo} · {e.services?.clients?.nome ?? "—"}
              </span>
              <span>{new Date(e.created_at).toLocaleString("pt-PT")} · {e.profiles?.nome ?? "—"}</span>
            </div>
            <p className="text-neutral-200">{e.descricao}</p>
          </div>
        ))}
        {(eventos ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">Ainda sem histórico financeiro.</p>
        )}
      </div>
    </div>
  );
}
