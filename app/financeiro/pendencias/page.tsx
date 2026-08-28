import { createClient } from "@/lib/supabase/server";

// Pendências relevantes para o financeiro: serviços bloqueados antes de
// chegarem a "por faturar" (correção pedida ao técnico). Só leitura — a
// ação de corrigir é do técnico, a de validar/rejeitar outra vez já está em
// Faturação.
export default async function PendenciasPage() {
  const supabase = createClient();

  const { data: pendentes } = await supabase
    .from("services")
    .select("id, tipo, descricao, valor, clients(nome)")
    .eq("estado", "correcao_necessaria")
    .order("created_at", { ascending: false });

  const { data: motivos } = await supabase
    .from("service_validations")
    .select("service_id, motivo, created_at")
    .eq("acao", "rejeitado")
    .order("created_at", { ascending: false });

  const motivoPorServico = new Map<string, string>();
  for (const m of motivos ?? []) {
    if (!motivoPorServico.has(m.service_id)) motivoPorServico.set(m.service_id, m.motivo ?? "");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Pendências</h1>
        <p className="mt-0.5 text-sm text-neutral-400">Serviços com correção pedida — ainda não podem seguir para faturação.</p>
      </div>

      <div className="space-y-2">
        {(pendentes ?? []).map((s: any) => (
          <div key={s.id} className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <div className="mb-1 flex items-start justify-between">
              <div>
                <div className="font-medium text-neutral-100">{s.clients?.nome}</div>
                <div className="text-sm text-neutral-300">{s.tipo} · {s.descricao}</div>
              </div>
              <span className="font-semibold text-neutral-200">
                {Number(s.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            {motivoPorServico.get(s.id) && (
              <p className="mt-1 text-sm text-red-400">Motivo: {motivoPorServico.get(s.id)}</p>
            )}
          </div>
        ))}
        {(pendentes ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">Sem pendências — tudo a seguir normalmente.</p>
        )}
      </div>
    </div>
  );
}
