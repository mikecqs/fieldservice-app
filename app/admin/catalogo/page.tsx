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
        <h1 className="text-xl font-bold text-white">Catálogo</h1>
        <p className="mt-0.5 text-sm text-neutral-400">
          Referências e preços importados de Excel (ex: export Wintouch) — usados ao criar linhas de orçamento.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Importar Excel</h2>
        <form action={importarCatalogo} className="flex flex-wrap items-center gap-2">
          <input
            name="ficheiro"
            type="file"
            accept=".xlsx,.xls"
            required
            className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-neutral-800 file:px-2 file:py-1 file:text-xs"
          />
          <button className="rounded-md bg-white px-3 py-2 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
            Importar
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          O ficheiro deve ter colunas de referência, descrição e preço de venda (os nomes exatos podem variar).
          Reimportar atualiza os itens existentes em vez de duplicar.
        </p>
      </div>

      <form method="get" className="mb-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Pesquisar por referência ou descrição…"
          className="w-full max-w-md rounded-md border border-neutral-700 px-3 py-2 text-sm"
        />
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="divide-y divide-slate-100">
          {(itens ?? []).map((i) => (
            <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="mr-2 font-mono text-xs text-neutral-500">{i.referencia}</span>
                {i.descricao}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-neutral-200">
                  {Number(i.preco_venda).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </span>
                <form action={removerItemCatalogo}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="text-xs text-red-400 hover:underline">remover</button>
                </form>
              </div>
            </div>
          ))}
          {(itens ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-neutral-500">
              {q ? "Sem resultados para essa pesquisa." : "Catálogo ainda vazio — importa um Excel acima."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
