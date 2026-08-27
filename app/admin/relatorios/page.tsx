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
        <h1 className="text-xl font-bold text-slate-900">Relatórios</h1>
        <p className="mt-0.5 text-sm text-slate-500">Visão geral da atividade da empresa.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Total faturado</div>
          <div className="text-2xl font-bold text-slate-900">
            {faturadoTotal.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Taxa de aceitação de orçamentos</div>
          <div className="text-2xl font-bold text-slate-900">
            {taxaConversao === null ? "—" : `${taxaConversao.toFixed(0)}%`}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Serviços por estado</h2>
        <div className="space-y-1.5">
          {[...porEstadoServico.entries()].map(([estado, count]) => (
            <div key={estado} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{estado}</span>
              <span className="font-medium text-slate-800">{count}</span>
            </div>
          ))}
          {porEstadoServico.size === 0 && <p className="text-sm text-slate-400">Ainda sem serviços.</p>}
        </div>
      </div>
    </div>
  );
}
