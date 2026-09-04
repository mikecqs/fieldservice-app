import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarCompra } from "../actions";
import { ItemRows } from "../ItemRows";
import { rotuloTipoServico } from "@/lib/servico-estado";

export default async function NovaCompraPage() {
  // Ocultado por decisão de produto (temporário) — ver app/admin/compras/page.tsx.
  redirect("/admin/servicos");

  const supabase = await createClient();
  const { data: servicos } = await supabase
    .from("services")
    .select("id, tipo, descricao, clients(nome)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/compras" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Compras
      </Link>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="mb-4 text-lg font-bold text-white">Nova compra</h1>
        <form action={criarCompra} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-300">Descrição</span>
            <input name="descricao" required className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Fornecedor (opcional)</span>
              <input name="fornecedor" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Data prevista</span>
              <input name="data_prevista" type="date" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-300">Ligar a um serviço (opcional)</span>
            <select name="service_id" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
              <option value="">—</option>
              {(servicos ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.clients?.nome} — {rotuloTipoServico(s.tipo)}</option>
              ))}
            </select>
          </label>

          <ItemRows />

          <div className="mt-2 flex justify-end gap-2">
            <Link href="/admin/compras" className="rounded-md border border-neutral-700 px-3.5 py-2 text-sm text-neutral-200">
              Cancelar
            </Link>
            <button type="submit" className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
              Guardar compra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
