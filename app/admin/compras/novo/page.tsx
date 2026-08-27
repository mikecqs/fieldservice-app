import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { criarCompra } from "../actions";
import { ItemRows } from "../ItemRows";

export default async function NovaCompraPage() {
  const supabase = createClient();
  const { data: servicos } = await supabase
    .from("services")
    .select("id, tipo, descricao, clients(nome)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/compras" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Compras
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold text-slate-900">Nova compra</h1>
        <form action={criarCompra} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Descrição</span>
            <input name="descricao" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Fornecedor (opcional)</span>
              <input name="fornecedor" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Data prevista</span>
              <input name="data_prevista" type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Ligar a um serviço (opcional)</span>
            <select name="service_id" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">—</option>
              {(servicos ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.clients?.nome} — {s.tipo}</option>
              ))}
            </select>
          </label>

          <ItemRows />

          <div className="mt-2 flex justify-end gap-2">
            <Link href="/admin/compras" className="rounded-md border border-slate-300 px-3.5 py-2 text-sm text-slate-700">
              Cancelar
            </Link>
            <button type="submit" className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800">
              Guardar compra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
