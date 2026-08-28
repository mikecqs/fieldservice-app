import { createClient } from "@/lib/supabase/server";
import { importarCatalogo, removerItemCatalogo } from "./actions";

export default async function CatalogoPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const q = (searchParams.q ?? "").trim();

  let query = supabase.from("catalog_items").select("id, referencia, descricao, preco_venda").order("referencia");
  if (q) query = query.or(`referencia.ilike.%${q}%,descricao.ilike.%${q}%`);
  const { data: itens } = await query.limit(300);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Catálogo</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Referências e preços importados de Excel (ex: export Wintouch) — usados ao criar linhas de orçamento.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Importar Excel</h2>
        <form action={importarCatalogo} className="flex flex-wrap items-center gap-2">
          <input
            name="ficheiro"
            type="file"
            accept=".xlsx,.xls"
            required
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
          />
          <button className="rounded-md bg-indigo-900 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-800">
            Importar
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          O ficheiro deve ter colunas de referência, descrição e preço de venda (os nomes exatos podem variar).
          Reimportar atualiza os itens existentes em vez de duplicar.
        </p>
      </div>

      <form method="get" className="mb-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Pesquisar por referência ou descrição…"
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {(itens ?? []).map((i) => (
            <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="mr-2 font-mono text-xs text-slate-400">{i.referencia}</span>
                {i.descricao}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-700">
                  {Number(i.preco_venda).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </span>
                <form action={removerItemCatalogo}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="text-xs text-red-600 hover:underline">remover</button>
                </form>
              </div>
            </div>
          ))}
          {(itens ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              {q ? "Sem resultados para essa pesquisa." : "Catálogo ainda vazio — importa um Excel acima."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
