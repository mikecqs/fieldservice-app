import { createClient } from "@/lib/supabase/server";
import { marcarFaturado } from "./actions";

export default async function FaturacaoPage() {
  const supabase = createClient();
  const { data: servicos } = await supabase
    .from("services")
    .select("id, tipo, descricao, valor, faturacao_estado, faturacao_data, faturacao_valor, faturacao_referencia, clients(nome)")
    .eq("estado", "concluido")
    .order("faturacao_estado")
    .order("created_at", { ascending: false });

  const porFaturar = (servicos ?? []).filter((s) => s.faturacao_estado === "por_faturar");
  const faturados = (servicos ?? []).filter((s) => s.faturacao_estado === "faturado");
  const totalPorFaturar = porFaturar.reduce((acc, s) => acc + Number(s.valor ?? 0), 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Faturação</h1>
        <p className="mt-0.5 text-sm text-slate-500">Serviços concluídos, por faturar ou já faturados.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-medium text-slate-500">Total por faturar</div>
        <div className="text-2xl font-bold text-slate-900">
          {totalPorFaturar.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
        </div>
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Por faturar · {porFaturar.length}</h2>
      <div className="mb-6 space-y-2">
        {porFaturar.map((s: any) => (
          <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="font-medium text-slate-800">{s.clients?.nome}</div>
                <div className="text-sm text-slate-500">{s.tipo} · {s.descricao}</div>
              </div>
              <span className="font-semibold text-slate-700">
                {Number(s.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <form action={marcarFaturado} className="flex gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input
                name="faturacao_valor"
                type="number"
                step="0.01"
                defaultValue={s.valor}
                className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              />
              <input
                name="faturacao_referencia"
                placeholder="Nº fatura / referência"
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              />
              <button className="rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">
                Marcar faturado
              </button>
            </form>
          </div>
        ))}
        {porFaturar.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Nada por faturar.</p>}
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Faturados · {faturados.length}</h2>
      <div className="space-y-2">
        {faturados.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3.5 text-sm">
            <div>
              <span className="font-medium text-slate-700">{s.clients?.nome}</span>
              <span className="ml-2 text-slate-400">{s.faturacao_referencia}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-500">
              <span>{s.faturacao_data}</span>
              <span className="font-semibold text-slate-700">
                {Number(s.faturacao_valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
            </div>
          </div>
        ))}
        {faturados.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Ainda sem faturas.</p>}
      </div>
    </div>
  );
}
