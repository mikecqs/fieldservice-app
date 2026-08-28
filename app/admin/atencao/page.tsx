import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { calcularPreparacao, PREPARACAO_BADGE, type NivelPreparacao } from "@/lib/preparacao";

export default async function AtencaoPage() {
  const supabase = createClient();
  const organizationId = await getOrgId();
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  const agoraHora = agora.toTimeString().slice(0, 8);
  const em3Dias = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const [
    { data: settings },
    { data: pedidosIncompletos },
    { data: servicosAtrasados },
    { data: comprasBloqueando },
    { data: orcamentos },
    { data: correcoesNecessarias },
    { data: novasVisitasPorAgendar },
    { data: aguardaValidacao },
    { data: validadoPorFaturar },
    { data: tecnicoAtrasado },
    { data: visitasAbertasAntigas },
    { data: servicosProximosDias },
    { data: comprasPendentesTodas },
  ] = await Promise.all([
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
    supabase
      .from("services")
      .select("id, descricao, clients(nome)")
      .eq("estado", "nova_visita")
      .is("data_agendada", null),
    supabase.from("services").select("id, descricao, clients(nome)").eq("estado", "aguarda_validacao"),
    supabase.from("services").select("id, descricao, clients(nome)").eq("estado", "concluido").eq("faturacao_estado", "por_faturar"),
    supabase
      .from("services")
      .select("id, descricao, hora_agendada, clients(nome), service_technicians(profiles(nome))")
      .eq("data_agendada", hoje)
      .eq("estado", "agendado")
      .lt("hora_agendada", agoraHora),
    supabase
      .from("visits")
      .select("id, data, service_id, services(id, descricao, estado, clients(nome))")
      .is("hora_fim_real", null)
      .lt("data", hoje),
    supabase
      .from("services")
      .select(
        "id, tipo, descricao, data_agendada, hora_agendada, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id)"
      )
      .gt("data_agendada", hoje)
      .lte("data_agendada", em3Dias)
      .not("estado", "in", "(cancelado,concluido,nao_realizado)"),
    supabase.from("purchases").select("service_id").in("estado", ["por_encomendar", "encomendada", "parcial"]),
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

  const servicosAbertosAntigos = (visitasAbertasAntigas ?? [])
    .filter((v: any) => v.services?.estado === "em_curso")
    .map((v: any) => v.services);

  const materialPendentePorServico = new Set((comprasPendentesTodas ?? []).map((c: any) => c.service_id));
  const naoPreparados = (servicosProximosDias ?? [])
    .map((s: any) => ({
      ...s,
      preparacao: calcularPreparacao({
        temTecnico: (s.service_technicians ?? []).length > 0,
        morada: s.client_addresses?.endereco,
        temContacto: !!(s.clients?.telefone || s.clients?.email),
        descricao: s.descricao,
        dataAgendada: s.data_agendada,
        horaAgendada: s.hora_agendada,
        materialBloqueando: materialPendentePorServico.has(s.id),
      }),
    }))
    .filter((s: any) => s.preparacao.nivel !== "preparada");

  const grupos = [
    {
      titulo: "Pedidos incompletos",
      itens: pedidosIncompletos ?? [],
      render: (p: any) => `${p.clients?.nome} — ${p.descricao}`,
      href: () => "/admin/pedidos",
    },
    {
      titulo: "Técnico atrasado",
      itens: tecnicoAtrasado ?? [],
      render: (s: any) => {
        const tecnicos = (s.service_technicians ?? []).map((t: any) => t.profiles?.nome).filter(Boolean).join(", ");
        return `${s.clients?.nome} — previsto para as ${s.hora_agendada?.slice(0, 5)}${tecnicos ? ` (${tecnicos})` : ""}, ainda não iniciado`;
      },
      href: (s: any) => `/admin/servicos/${s.id}`,
    },
    {
      titulo: "Serviços atrasados",
      itens: servicosAtrasados ?? [],
      render: (s: any) => `${s.clients?.nome} — agendado para ${s.data_agendada}`,
      href: (s: any) => `/admin/servicos/${s.id}`,
    },
    {
      titulo: "Serviço ainda aberto",
      itens: servicosAbertosAntigos,
      render: (s: any) => `${s.clients?.nome} — em curso desde antes de hoje, nunca fechado`,
      href: (s: any) => `/admin/servicos/${s.id}`,
    },
    {
      titulo: "OS concluída — aguarda validação",
      itens: aguardaValidacao ?? [],
      render: (s: any) => `${s.clients?.nome} — ${s.descricao}`,
      href: () => "/admin/faturacao",
    },
    {
      titulo: "OS validada — por faturar",
      itens: validadoPorFaturar ?? [],
      render: (s: any) => `${s.clients?.nome} — ${s.descricao}`,
      href: () => "/admin/faturacao",
    },
    {
      titulo: "OS rejeitada / correção necessária",
      itens: correcoesNecessarias ?? [],
      render: (s: any) => `${s.clients?.nome} — ${s.descricao}`,
      href: (s: any) => `/admin/servicos/${s.id}`,
    },
    {
      titulo: "Nova visita por agendar",
      itens: novasVisitasPorAgendar ?? [],
      render: (s: any) => `${s.clients?.nome} — ${s.descricao} (cliente ainda não combinou data)`,
      href: (s: any) => `/admin/servicos/${s.id}`,
    },
    {
      titulo: "Material a bloquear serviço",
      itens: comprasUrgentes,
      render: (c: any) => `${c.descricao} — para ${c.services?.clients?.nome} em ${c.services?.data_agendada}`,
      href: () => "/admin/compras",
    },
    {
      titulo: "Orçamento sem resposta",
      itens: orcamentosParados,
      render: (o: any) => `${o.clients?.nome} — enviado ${o.enviado_em ?? ""}`,
      href: (o: any) => `/admin/orcamentos/${o.id}`,
    },
    {
      titulo: `Serviço futuro não preparado (até ${em3Dias})`,
      itens: naoPreparados,
      render: (s: any) => `${PREPARACAO_BADGE[s.preparacao.nivel as NivelPreparacao].emoji} ${s.clients?.nome} — ${s.data_agendada} · ${s.preparacao.motivos.join(", ")}`,
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
