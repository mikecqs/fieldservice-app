import { createClient } from "@/lib/supabase/server";
import { criarCompraRapida } from "../compras/actions";

export default async function MateriaisPage() {
  const supabase = createClient();

  const [{ data: planeados }, { data: comprasPendentes }] = await Promise.all([
    supabase
      .from("service_materials_planned")
      .select("id, nome, qtd, service_id, services(descricao, estado, clients(nome))")
      .order("nome"),
    supabase
      .from("purchases")
      .select("service_id, purchase_items(nome)")
      .in("estado", ["por_encomendar", "encomendada", "parcial"])
      .not("service_id", "is", null),
  ]);

  const ativos = (planeados ?? []).filter(
    (m: any) => !["concluido", "cancelado", "nao_realizado"].includes(m.services?.estado)
  );

  const pendentes = new Set(
    (comprasPendentes ?? []).flatMap((c: any) =>
      (c.purchase_items ?? []).map((i: any) => `${c.service_id}::${i.nome}`)
    )
  );

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Materiais</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Materiais planeados nos serviços ainda em curso — não há um catálogo, isto vem diretamente do que foi
          planeado em cada serviço.
        </p>
      </div>

      <div className="space-y-2">
        {ativos.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <div className="font-medium text-slate-800">{m.nome} · {m.qtd}</div>
              <div className="text-xs text-slate-400">
                {m.services?.clients?.nome} — {m.services?.descricao}
              </div>
            </div>
            {pendentes.has(`${m.service_id}::${m.nome}`) ? (
              <button
                disabled
                className="cursor-not-allowed rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700"
              >
                ✓ Adicionado
              </button>
            ) : (
              <form action={criarCompraRapida}>
                <input type="hidden" name="nome" value={m.nome} />
                <input type="hidden" name="qtd" value={m.qtd} />
                <input type="hidden" name="service_id" value={m.service_id} />
                <button className="rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">
                  Criar compra
                </button>
              </form>
            )}
          </div>
        ))}
        {ativos.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Sem materiais planeados em serviços ativos.</p>
        )}
      </div>
    </div>
  );
}
