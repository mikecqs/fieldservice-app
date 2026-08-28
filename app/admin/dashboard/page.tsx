import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularPreparacao, PREPARACAO_BADGE, type NivelPreparacao } from "@/lib/preparacao";

// Nenhuma destas queries filtra explicitamente por organization_id — não
// precisa: a RLS definida em schema.sql já garante que um Admin só consegue
// ler linhas da sua própria empresa. Isto é o que torna impossível "esquecer"
// um filtro e vazar dados de outra empresa nalguma página futura.
export default async function DashboardPage() {
  const supabase = createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [{ count: hojeCount }, { data: porFaturar }, { count: pedidosNovos }, { count: orcamentosAbertos }, { data: servicosAmanha }, { data: comprasPendentes }] =
    await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true }).eq("data_agendada", hoje),
      supabase.from("services").select("valor").eq("estado", "concluido").eq("faturacao_estado", "por_faturar"),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("estado", "novo"),
      supabase.from("budgets").select("id", { count: "exact", head: true }).in("estado", ["enviado", "aguarda_resposta", "followup"]),
      supabase
        .from("services")
        .select(
          "id, tipo, descricao, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id), hora_agendada"
        )
        .eq("data_agendada", amanha)
        .not("estado", "in", "(cancelado,concluido,nao_realizado)"),
      supabase.from("purchases").select("service_id").in("estado", ["por_encomendar", "encomendada", "parcial"]),
    ]);

  const totalPorFaturar = (porFaturar ?? []).reduce((acc, s) => acc + (s.valor ?? 0), 0);

  const stats = [
    { label: "Agendado para hoje", value: hojeCount ?? 0 },
    { label: "Por faturar", value: totalPorFaturar.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) },
    { label: "Pedidos novos", value: pedidosNovos ?? 0 },
    { label: "Orçamentos em aberto", value: orcamentosAbertos ?? 0 },
  ];

  const materialPendentePorServico = new Set((comprasPendentes ?? []).map((c: any) => c.service_id));
  const amanhaComPreparacao = (servicosAmanha ?? []).map((s: any) => ({
    ...s,
    preparacao: calcularPreparacao({
      temTecnico: (s.service_technicians ?? []).length > 0,
      morada: s.client_addresses?.endereco,
      temContacto: !!(s.clients?.telefone || s.clients?.email),
      descricao: s.descricao,
      dataAgendada: amanha,
      horaAgendada: s.hora_agendada,
      materialBloqueando: materialPendentePorServico.has(s.id),
    }),
  }));
  const preparados = amanhaComPreparacao.filter((s) => s.preparacao.nivel === "preparada");
  const infoFalta = amanhaComPreparacao.filter((s) => s.preparacao.nivel === "info_falta");
  const bloqueados = amanhaComPreparacao.filter((s) => s.preparacao.nivel === "bloqueada");

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-white">Dashboard</h1>
      <p className="mb-6 text-sm text-neutral-400">O que precisa da sua atenção agora.</p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-2 text-xs font-medium text-neutral-400">{s.label}</div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-1 text-sm font-bold text-neutral-100">
          Amanhã — {amanhaComPreparacao.length} serviço{amanhaComPreparacao.length === 1 ? "" : "s"}
        </h2>
        {amanhaComPreparacao.length === 0 ? (
          <p className="text-sm text-neutral-500">Sem serviços agendados para amanhã.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <span className="text-emerald-400">🟢 {preparados.length} preparado{preparados.length === 1 ? "" : "s"}</span>
              {infoFalta.length > 0 && (
                <span className="text-amber-400">🟠 {infoFalta.length} com informação em falta</span>
              )}
              {bloqueados.length > 0 && (
                <span className="text-red-400">🔴 {bloqueados.length} bloqueado{bloqueados.length === 1 ? "" : "s"}</span>
              )}
            </div>
            {(infoFalta.length > 0 || bloqueados.length > 0) && (
              <div className="mt-3 space-y-1.5 border-t border-neutral-800 pt-3">
                {[...bloqueados, ...infoFalta].map((s: any) => (
                  <Link
                    key={s.id}
                    href={`/admin/servicos/${s.id}`}
                    className={`block rounded-md p-2 text-xs ${PREPARACAO_BADGE[s.preparacao.nivel as NivelPreparacao].cls} hover:opacity-80`}
                  >
                    {PREPARACAO_BADGE[s.preparacao.nivel as NivelPreparacao].emoji} {s.clients?.nome} — {s.tipo} · {s.preparacao.motivos.join(", ")}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        Para o panorama completo de alertas (pedidos incompletos, atrasos, material em falta,
        follow-ups de orçamentos…), vê a{" "}
        <Link href="/admin/atencao" className="text-neutral-200 underline">
          Central de Atenção
        </Link>
        .
      </p>
    </div>
  );
}
