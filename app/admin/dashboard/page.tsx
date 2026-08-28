import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Nenhuma destas queries filtra explicitamente por organization_id — não
// precisa: a RLS definida em schema.sql já garante que um Admin só consegue
// ler linhas da sua própria empresa. Isto é o que torna impossível "esquecer"
// um filtro e vazar dados de outra empresa nalguma página futura.
export default async function DashboardPage() {
  const supabase = createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ count: hojeCount }, { data: porFaturar }, { count: pedidosNovos }, { count: orcamentosAbertos }] =
    await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true }).eq("data_agendada", hoje),
      supabase.from("services").select("valor").eq("estado", "concluido").eq("faturacao_estado", "por_faturar"),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("estado", "novo"),
      supabase.from("budgets").select("id", { count: "exact", head: true }).in("estado", ["enviado", "aguarda_resposta", "followup"]),
    ]);

  const totalPorFaturar = (porFaturar ?? []).reduce((acc, s) => acc + (s.valor ?? 0), 0);

  const stats = [
    { label: "Agendado para hoje", value: hojeCount ?? 0 },
    { label: "Por faturar", value: totalPorFaturar.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) },
    { label: "Pedidos novos", value: pedidosNovos ?? 0 },
    { label: "Orçamentos em aberto", value: orcamentosAbertos ?? 0 },
  ];

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">O que precisa da sua atenção agora.</p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-medium text-slate-500">{s.label}</div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Para o panorama completo de alertas (pedidos incompletos, atrasos, material em falta,
        follow-ups de orçamentos…), vê a{" "}
        <Link href="/admin/atencao" className="text-indigo-700 underline">
          Central de Atenção
        </Link>
        .
      </p>
    </div>
  );
}
