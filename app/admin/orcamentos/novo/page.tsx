import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { criarOrcamento } from "../actions";

export default async function NovoOrcamentoPage({
  searchParams,
}: {
  searchParams: { client_id?: string };
}) {
  const supabase = createClient();
  const { data: clients } = await supabase.from("clients").select("id, nome").order("nome");

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/orcamentos" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Orçamentos
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold text-slate-900">Novo orçamento</h1>
        {(clients ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">
            Precisas de ter pelo menos um cliente criado. <Link href="/admin/clientes/novo" className="text-indigo-700 underline">Criar cliente</Link>.
          </p>
        ) : (
          <form action={criarOrcamento} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Cliente</span>
              <select
                name="client_id"
                required
                defaultValue={searchParams.client_id}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-slate-400">
              Depois de criares, adicionas as linhas de orçamento (materiais, mão de obra…) na página seguinte.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Link href="/admin/orcamentos" className="rounded-md border border-slate-300 px-3.5 py-2 text-sm text-slate-700">
                Cancelar
              </Link>
              <button type="submit" className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800">
                Criar orçamento
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
