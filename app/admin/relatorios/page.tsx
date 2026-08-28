import { createClient } from "@/lib/supabase/server";

export default async function RelatoriosPage() {
  const supabase = createClient();

  const [{ data: servicos }, { data: orcamentos }] = await Promise.all([
    supabase.from("services").select("estado, faturacao_estado, faturacao_valor"),
    supabase.from("budgets").select("estado"),
  ]);

  const porEstadoServico = new Map<string, number>();
  for (const s of servicos ?? []) {
    porEstadoServico.set(s.estado, (porEstadoServico.get(s.estado) ?? 0) + 1);
  }

  const faturadoTotal = (servicos ?? [])
    .filter((s) => s.faturacao_estado === "faturado")
    .reduce((acc, s) => acc + Number(s.faturacao_valor ?? 0), 0);

  const aceites = (orcamentos ?? []).filter((o) => o.estado === "aceite").length;
  const recusados = (orcamentos ?? []).filter((o) => o.estado === "recusado").length;
  const taxaConversao = aceites + recusados > 0 ? (aceites / (aceites + recusados)) * 100 : null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Relatórios</h1>
        <p className="mt-0.5 text-sm text-neutral-400">Visão geral da atividade da empresa.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs font-medium text-neutral-400">Total faturado</div>
          <div className="text-2xl font-bold text-white">
            {faturadoTotal.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs font-medium text-neutral-400">Taxa de aceitação de orçamentos</div>
          <div className="text-2xl font-bold text-white">
            {taxaConversao === null ? "—" : `${taxaConversao.toFixed(0)}%`}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Serviços por estado</h2>
        <div className="space-y-1.5">
          {[...porEstadoServico.entries()].map(([estado, count]) => (
            <div key={estado} className="flex items-center justify-between text-sm">
              <span className="text-neutral-300">{estado}</span>
              <span className="font-medium text-neutral-100">{count}</span>
            </div>
          ))}
          {porEstadoServico.size === 0 && <p className="text-sm text-neutral-500">Ainda sem serviços.</p>}
        </div>
      </div>
    </div>
  );
}
