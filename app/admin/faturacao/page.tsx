import { createClient } from "@/lib/supabase/server";
import { marcarFaturado } from "./actions";
import { validarServico, enviarParaCorrecao } from "../servicos/actions";

export default async function FaturacaoPage() {
  const supabase = createClient();

  const { data: aguardamValidacao } = await supabase
    .from("services")
    .select("id, tipo, descricao, valor, clients(nome)")
    .eq("estado", "aguarda_validacao")
    .order("created_at", { ascending: false });

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

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
        Aguardam validação · {(aguardamValidacao ?? []).length}
      </h2>
      <div className="mb-6 space-y-2">
        {(aguardamValidacao ?? []).map((s: any) => (
          <div key={s.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="font-medium text-slate-800">{s.clients?.nome}</div>
                <div className="text-sm text-slate-600">{s.tipo} · {s.descricao}</div>
              </div>
              <span className="font-semibold text-slate-700">
                {Number(s.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={validarServico}>
                <input type="hidden" name="id" value={s.id} />
                <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
                  Validar
                </button>
              </form>
              <details className="relative">
                <summary className="list-none cursor-pointer rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                  Mandar para trás
                </summary>
                <form
                  action={enviarParaCorrecao}
                  className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <input type="hidden" name="id" value={s.id} />
                  <span className="block text-xs font-medium text-slate-600">Motivo (obrigatório)</span>
                  <textarea
                    name="motivo"
                    required
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                    placeholder="Ex: guia do Wintouch indica 5 câmaras, técnico registou 4."
                  />
                  <button className="w-full rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
                    Confirmar rejeição
                  </button>
                </form>
              </details>
            </div>
          </div>
        ))}
        {(aguardamValidacao ?? []).length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">Nada à espera de validação.</p>
        )}
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
