import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularOrcamento } from "@/lib/orcamento";

const ESTADO_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aguarda_resposta: "Aguarda resposta",
  followup: "Follow-up",
  aceite: "Aceite",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

const ESTADO_COLOR: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  enviado: "bg-sky-100 text-sky-800",
  aguarda_resposta: "bg-amber-100 text-amber-800",
  followup: "bg-orange-100 text-orange-800",
  aceite: "bg-emerald-100 text-emerald-800",
  recusado: "bg-red-100 text-red-800",
  cancelado: "bg-slate-100 text-slate-500",
};

export default async function OrcamentosPage() {
  const supabase = createClient();
  const { data: orcamentos } = await supabase
    .from("budgets")
    .select("id, estado, criado_em, enviado_em, iva_percent, clients(nome), budget_items(qtd, valor_unit)")
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase.from("clients").select("id, nome").order("nome");

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Orçamentos</h1>
          <p className="mt-0.5 text-sm text-slate-500">Do rascunho até à aceitação (que gera o serviço).</p>
        </div>
        <details className="relative">
          <summary className="list-none cursor-pointer rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800">
            Novo orçamento
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <form action="/admin/orcamentos/novo" method="get" className="space-y-2">
              <span className="block text-xs font-medium text-slate-600">Cliente</span>
              <select name="client_id" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <button className="w-full rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">
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
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
            >
              <div>
                <div className="font-medium text-slate-800">{o.clients?.nome}</div>
                <div className="text-xs text-slate-400">Criado {o.criado_em}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-700">
                    {total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                  </div>
                  <div className="text-[10px] text-slate-400">c/ IVA ({o.iva_percent}%)</div>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[o.estado] ?? ""}`}>
                  {ESTADO_LABEL[o.estado] ?? o.estado}
                </span>
              </div>
            </Link>
          );
        })}
        {(orcamentos ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Ainda sem orçamentos.</p>
        )}
      </div>
    </div>
  );
}
