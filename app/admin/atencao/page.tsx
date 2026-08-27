import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

export default async function AtencaoPage() {
  const supabase = createClient();
  const organizationId = await getOrgId();
  const hoje = new Date().toISOString().slice(0, 10);
  const em3Dias = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const [{ data: settings }, { data: pedidosIncompletos }, { data: servicosAtrasados }, { data: comprasBloqueando }, { data: orcamentos }, { data: correcoesNecessarias }] =
    await Promise.all([
      supabase.from("org_settings").select("followup_dias_default").eq("organization_id", organizationId).single(),
      supabase.from("requests").select("id, descricao, clients(nome)").eq("info_falta", true).eq("estado", "novo"),
      supabase
        .from("services")
        .select("id, descricao, data_agendada, clients(nome)")
        .lt("data_agendada", hoje)
        .not("data_agendada", "is", null)
        .not("estado", "in", "(concluido,cancelado,nao_realizado)"),
      supabase
        .from("purchases")
        .select("id, descricao, estado, service_id, services(data_agendada, clients(nome))")
        .in("estado", ["por_encomendar", "encomendada", "parcial"]),
      supabase.from("budgets").select("id, estado, enviado_em, clients(nome)").in("estado", ["enviado", "aguarda_resposta", "followup"]),
      supabase.from("services").select("id, descricao, clients(nome)").eq("estado", "correcao_necessaria"),
    ]);

  const followupDias = settings?.followup_dias_default ?? 3;

  const comprasUrgentes = (comprasBloqueando ?? []).filter((c: any) => {
    const data = c.services?.data_agendada;
    return data && data <= em3Dias;
  });

  const orcamentosParados = (orcamentos ?? []).filter((o: any) => {
    if (o.estado === "followup") return true;
    if (!o.enviado_em) return false;
    const diasPassados = (Date.now() - new Date(o.enviado_em).getTime()) / 86400000;
    return diasPassados >= followupDias;
  });

  const grupos = [
    {
      titulo: "Pedidos incompletos",
      itens: pedidosIncompletos ?? [],
      render: (p: any) => `${p.clients?.nome} — ${p.descricao}`,
      href: () => "/admin/pedidos",
    },
    {
      titulo: "Serviços atrasados",
      itens: servicosAtrasados ?? [],
      render: (s: any) => `${s.clients?.nome} — agendado para ${s.data_agendada}`,
      href: (s: any) => `/admin/servicos/${s.id}`,
    },
    {
      titulo: "Material a bloquear serviços agendados",
      itens: comprasUrgentes,
      render: (c: any) => `${c.descricao} — para ${c.services?.clients?.nome} em ${c.services?.data_agendada}`,
      href: () => "/admin/compras",
    },
    {
      titulo: "Orçamentos à espera de follow-up",
      itens: orcamentosParados,
      render: (o: any) => `${o.clients?.nome} — enviado ${o.enviado_em ?? ""}`,
      href: (o: any) => `/admin/orcamentos/${o.id}`,
    },
    {
      titulo: "Serviços com correção necessária",
      itens: correcoesNecessarias ?? [],
      render: (s: any) => `${s.clients?.nome} — ${s.descricao}`,
      href: (s: any) => `/admin/servicos/${s.id}`,
    },
  ];

  const totalAlertas = grupos.reduce((acc, g) => acc + g.itens.length, 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Atenção</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {totalAlertas === 0 ? "Tudo em dia, sem alertas pendentes." : `${totalAlertas} situação(ões) a precisar de ação.`}
        </p>
      </div>

      <div className="space-y-6">
        {grupos
          .filter((g) => g.itens.length > 0)
          .map((g) => (
            <div key={g.titulo}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                {g.titulo} · {g.itens.length}
              </h2>
              <div className="space-y-1.5">
                {g.itens.map((item: any) => (
                  <Link
                    key={item.id}
                    href={g.href(item)}
                    className="block rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100"
                  >
                    {g.render(item)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        {totalAlertas === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Sem alertas — bom trabalho.</p>
        )}
      </div>
    </div>
  );
}
