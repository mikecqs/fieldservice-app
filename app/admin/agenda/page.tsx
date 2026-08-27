import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AgendaPage() {
  const supabase = createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: servicos } = await supabase
    .from("services")
    .select("id, tipo, descricao, prioridade, estado, data_agendada, hora_agendada, clients(nome)")
    .not("data_agendada", "is", null)
    .gte("data_agendada", hoje)
    .in("estado", ["agendado", "em_curso", "nova_visita"])
    .order("data_agendada")
    .order("hora_agendada");

  const grupos = new Map<string, any[]>();
  for (const s of servicos ?? []) {
    const lista = grupos.get(s.data_agendada) ?? [];
    lista.push(s);
    grupos.set(s.data_agendada, lista);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Agenda</h1>
        <p className="mt-0.5 text-sm text-slate-500">Serviços agendados a partir de hoje.</p>
      </div>

      <div className="space-y-5">
        {[...grupos.entries()].map(([data, lista]) => (
          <div key={data}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              {new Date(data + "T00:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}
            </h2>
            <div className="space-y-2">
              {lista.map((s: any) => (
                <Link
                  key={s.id}
                  href={`/admin/servicos/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3.5 hover:border-indigo-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-sm font-semibold text-slate-700">
                      {s.hora_agendada?.slice(0, 5) ?? "—"}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-800">{s.clients?.nome}</div>
                      <div className="text-xs text-slate-400">{s.tipo} · {s.descricao}</div>
                    </div>
                  </div>
                  {s.prioridade === "alta" && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">Alta</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {grupos.size === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Sem serviços agendados.</p>
        )}
      </div>
    </div>
  );
}
