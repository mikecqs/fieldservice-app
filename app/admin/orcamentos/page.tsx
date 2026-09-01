import { createClient } from "@/lib/supabase/server";
import { calcularOrcamento } from "@/lib/orcamento";
import { OrcamentosLista } from "./OrcamentosLista";

export default async function OrcamentosPage() {
  const supabase = createClient();
  const { data: orcamentos } = await supabase
    .from("budgets")
    .select("id, numero, estado, criado_em, enviado_em, iva_percent, clients(nome), budget_items(qtd, valor_unit)")
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase.from("clients").select("id, nome").order("nome");

  const orcamentosComTotal = (orcamentos ?? []).map((o: any) => {
    const { total } = calcularOrcamento(o.budget_items ?? [], o.iva_percent);
    return { ...o, total };
  });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Orçamentos</h1>
          <p className="mt-0.5 text-sm text-neutral-400">Do rascunho até à aceitação (que gera o serviço).</p>
        </div>
        <details className="relative">
          <summary className="list-none cursor-pointer rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
            Novo orçamento
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-lg">
            <form action="/admin/orcamentos/novo" method="get" className="space-y-2">
              <span className="block text-xs font-medium text-neutral-300">Cliente</span>
              <select name="client_id" className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-sm">
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <button className="w-full rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
                Continuar
              </button>
            </form>
          </div>
        </details>
      </div>

      <OrcamentosLista orcamentos={orcamentosComTotal} />
    </div>
  );
}
