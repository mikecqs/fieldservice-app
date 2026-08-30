import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularOrcamento } from "@/lib/orcamento";
import { ESTADO_LABEL, ESTADO_COLOR } from "@/lib/orcamento-visual";

export default async function OrcamentosPage() {
  const supabase = createClient();
  const { data: orcamentos } = await supabase
    .from("budgets")
    .select("id, numero, estado, criado_em, enviado_em, iva_percent, clients(nome), budget_items(qtd, valor_unit)")
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase.from("clients").select("id, nome").order("nome");

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

      <div className="space-y-2">
        {(orcamentos ?? []).map((o: any) => {
          const { total } = calcularOrcamento(o.budget_items ?? [], o.iva_percent);
          return (
            <Link
              key={o.id}
              href={`/admin/orcamentos/${o.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 hover:shadow-sm"
            >
              <div>
                <div className="font-medium text-neutral-100">#{o.numero} · {o.clients?.nome}</div>
                <div className="text-xs text-neutral-500">Criado {o.criado_em}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-neutral-200">
                    {total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                  </div>
                  <div className="text-[10px] text-neutral-500">c/ IVA ({o.iva_percent}%)</div>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[o.estado] ?? ""}`}>
                  {ESTADO_LABEL[o.estado] ?? o.estado}
                </span>
              </div>
            </Link>
          );
        })}
        {(orcamentos ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">Ainda sem orçamentos.</p>
        )}
      </div>
    </div>
  );
}
