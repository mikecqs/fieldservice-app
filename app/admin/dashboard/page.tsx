import Link from "next/link";
import {
  Circle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wrench,
  Receipt,
  Wallet,
  CalendarClock,
  Users,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { getFinanceiroStats, formatEuros } from "@/lib/financeiro";
import { ESTADO_LABEL, ESTADO_COLOR } from "../servicos/estados";
import { toISO, addDays, nowTimeHHMMSS, startOfLocalDayUTC } from "@/lib/agenda-dates";
import { estaAtrasado, orcamentoPrecisaFollowup, ESTADOS_SERVICO_POR_AGENDAR } from "@/lib/operacional";
import { calcularPreparacao } from "@/lib/preparacao";
import { rotuloTipoServico } from "@/lib/servico-estado";
import { ProgressoDiaDonut } from "@/components/dashboard/ProgressoDiaDonut";

// Estados que já não fazem parte do trabalho "por realizar" de hoje — o
// técnico já não vai voltar a mexer no serviço no âmbito do dia agendado.
const ESTADOS_TERMINAIS_HOJE = ["concluido", "aguarda_validacao", "nova_visita", "nao_realizado", "cancelado"];

// Severidade puramente visual (nunca uma regra de negócio nova) — só decide
// a cor/ícone com que cada grupo de "Ação necessária" aparece, para o mais
// urgente (atraso, correção) se destacar de algo apenas informativo
// (aguarda validação). O critério que decide QUAIS itens entram em cada
// grupo continua exatamente o mesmo de sempre (lib/operacional.ts).
type Severidade = "critico" | "atencao" | "info";
const SEVERIDADE_CFG: Record<Severidade, { label: string; card: string; badge: string; iconColor: string; icon: typeof AlertTriangle }> = {
  critico: {
    label: "Crítico",
    card: "border-red-500/25 bg-red-500/[0.07]",
    badge: "bg-red-500/15 text-red-400",
    iconColor: "text-red-400",
    icon: AlertTriangle,
  },
  atencao: {
    label: "Atenção",
    card: "border-amber-500/25 bg-amber-500/[0.07]",
    badge: "bg-amber-500/15 text-amber-400",
    iconColor: "text-amber-400",
    icon: Clock,
  },
  info: {
    label: "A processar",
    card: "border-sky-500/25 bg-sky-500/[0.07]",
    badge: "bg-sky-500/15 text-sky-400",
    iconColor: "text-sky-400",
    icon: Inbox,
  },
};

// Dashboard Admin = Central Operacional. Todas as queries reutilizam
// exatamente os mesmos estados/eventos já usados em Atenção, Agenda e
// Financeiro — não existe aqui nenhum sistema de alertas novo, só leituras
// específicas dos mesmos dados para o recorte "hoje + o que precisa de
// ação". Nenhuma query filtra organization_id explicitamente (exceto onde
// já era assim no resto do Admin) porque a RLS de cada tabela já garante o
// isolamento por empresa.
export default async function DashboardPage() {
  const supabase = await createClient();
  const organizationId = await getOrgId();

  const agora = new Date();
  // Data/hora sempre locais (nunca toISOString(), que é UTC) — para o dia
  // operacional bater sempre certo com a Atenção e a Agenda perto da meia-
  // noite. Mesmos critérios de sempre, só a base de data/hora é partilhada.
  const hoje = toISO(agora);
  const amanha = toISO(addDays(agora, 1));
  const agoraHora = nowTimeHHMMSS(agora);
  const em3Dias = toISO(addDays(agora, 3));

  const [
    { data: servicosHojeRaw },
    { count: concluidosHojeCount },
    { count: pedidosNovos },
    { data: orcamentosAbertos },
    { data: settings },
    { data: tecnicos },
    { data: porAgendar },
    { data: aguardaValidacao },
    { data: porFaturarRows },
    financeiroHoje,
    // --- grupos que vinham só da antiga Central de Atenção (agora eliminada
    // — todo o alerta operacional vive só aqui, nunca em duas páginas) ---
    { data: pedidosIncompletos },
    { data: servicosAtrasadosPassado },
    { data: visitasAbertasAntigas },
    { data: correcoesNecessarias },
    { data: servicosProximosDias },
    // Só para o painel visual "Pedidos recentes" (distinguir Assistência vs
    // Orçamento) — o KPI "Pedidos novos" acima continua a vir do count
    // exato; isto é só uma amostra dos mais recentes para mostrar o tipo.
    { data: pedidosRecentes },
  ] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, tipo, descricao, estado, prioridade, hora_agendada, hora_fim_agendada, clients(nome), service_technicians(user_id, profiles(nome))"
      )
      .eq("data_agendada", hoje)
      .order("hora_agendada"),
    // "Concluído hoje" vem do histórico de eventos (service_events), não do
    // estado atual — assim um serviço agendado para outro dia mas fechado
    // hoje conta corretamente, e um serviço de hoje que entretanto voltou
    // para "correção necessária" deixa de contar (o evento fica no
    // histórico, mas o resumo do dia reflete a situação real).
    supabase
      .from("service_events")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "concluido")
      // created_at é timestamptz — usar o instante UTC correspondente à
      // meia-noite LOCAL (startOfLocalDayUTC), não a string "hoje" (que
      // seria lida como meia-noite UTC e desalinharia perto da virada do
      // dia local).
      .gte("created_at", startOfLocalDayUTC(agora))
      .lt("created_at", startOfLocalDayUTC(addDays(agora, 1))),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("estado", "novo"),
    supabase
      .from("budgets")
      .select("id, estado, enviado_em, followup_em, clients(nome)")
      .in("estado", ["enviado", "aguarda_resposta", "followup"]),
    supabase.from("org_settings").select("followup_dias_default").eq("organization_id", organizationId).single(),
    supabase.from("profiles").select("id, nome").eq("organization_id", organizationId).eq("role", "TECHNICIAN").order("nome"),
    // Mesmo critério já usado na Agenda para "Pendentes de agendamento"
    // (ESTADOS_SERVICO_POR_AGENDAR, em lib/operacional.ts).
    supabase
      .from("services")
      .select("id, tipo, descricao, clients(nome)")
      .is("data_agendada", null)
      .in("estado", ESTADOS_SERVICO_POR_AGENDAR)
      .order("created_at", { ascending: false }),
    // Mesmo critério já usado em Atenção para "OS concluída — aguarda validação".
    supabase.from("services").select("id, descricao, clients(nome)").eq("estado", "aguarda_validacao"),
    // Só para a lista/contagem de "Ação necessária" — o valor total (€) vem
    // sempre de getFinanceiroStats abaixo, nunca recalculado aqui.
    supabase.from("services").select("id, descricao, clients(nome)").eq("estado", "concluido").eq("faturacao_estado", "por_faturar"),
    // Única fonte de verdade para valores financeiros (ver lib/financeiro.ts)
    // — chamado com desde=ate=hoje: totalFaturado/totalRecebido ficam
    // filtrados a hoje (faturacao_data/faturacao_liquidado_data), enquanto
    // totalPorFaturar é sempre o backlog atual (não depende do intervalo).
    getFinanceiroStats(supabase, hoje, hoje),
    supabase.from("requests").select("id, descricao, clients(nome)").eq("info_falta", true).eq("estado", "novo"),
    supabase
      .from("services")
      .select("id, descricao, data_agendada, clients(nome)")
      .lt("data_agendada", hoje)
      .not("data_agendada", "is", null)
      .not("estado", "in", "(concluido,cancelado,nao_realizado)"),
    supabase
      .from("visits")
      .select("id, data, service_id, services(id, descricao, estado, clients(nome))")
      .is("hora_fim_real", null)
      .lt("data", hoje),
    supabase.from("services").select("id, descricao, clients(nome)").eq("estado", "correcao_necessaria"),
    supabase
      .from("services")
      .select(
        "id, tipo, descricao, data_agendada, hora_agendada, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id)"
      )
      .gt("data_agendada", hoje)
      .lte("data_agendada", em3Dias)
      .not("estado", "in", "(cancelado,concluido,nao_realizado)"),
    supabase
      .from("requests")
      .select("id, codigo, tipo, origem, created_at, clients(nome)")
      .eq("estado", "novo")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const servicosHoje = (servicosHojeRaw ?? []) as any[];

  // --- Resumo do dia ---------------------------------------------------
  const agendadosHoje = servicosHoje.length;
  const pendentesHoje = servicosHoje.filter((s) => !ESTADOS_TERMINAIS_HOJE.includes(s.estado));
  const concluidosHojeDoAgendamento = servicosHoje.filter((s) => s.estado === "concluido" || s.estado === "aguarda_validacao").length;
  const naoAgendadosCancelados = servicosHoje.filter((s) => s.estado === "cancelado").length;

  // --- Ação necessária ---------------------------------------------------
  // Técnico atrasado: mesmo critério de "Técnico atrasado" em Atenção
  // (estaAtrasado, em lib/operacional.ts) — serviço de hoje ainda
  // "agendado" (nunca iniciado) cuja hora já passou.
  const tecnicosAtrasados = servicosHoje.filter((s) => estaAtrasado(s, agoraHora));

  const semTecnicoHoje = servicosHoje.filter(
    (s) => !ESTADOS_TERMINAIS_HOJE.includes(s.estado) && (s.service_technicians ?? []).length === 0
  );

  const followupDias = settings?.followup_dias_default ?? 3;
  const orcamentosComEstado = (orcamentosAbertos ?? []).map((o: any) => {
    // Mesma lógica de "orçamento parado" já usada em Atenção
    // (orcamentoPrecisaFollowup, em lib/operacional.ts).
    const vencido = orcamentoPrecisaFollowup(o, hoje, followupDias);
    const venceHoje = o.followup_em === hoje;
    return { ...o, vencido, venceHoje };
  });
  const followupsHoje = orcamentosComEstado.filter((o) => o.venceHoje);
  const followupsAtrasados = orcamentosComEstado.filter((o) => o.vencido && !o.venceHoje);

  // --- Grupos que vinham só da antiga Central de Atenção — mesma lógica,
  // agora só aqui (a página /admin/atencao foi eliminada). ---
  const servicosAbertosAntigos = (visitasAbertasAntigas ?? [])
    .filter((v: any) => v.services?.estado === "em_curso")
    .map((v: any) => v.services);
  // Compras ocultado por decisão de produto (temporário) — sinal de
  // "material bloqueando" desligado, os restantes critérios de preparação
  // continuam ativos.
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
        materialBloqueando: false,
      }),
    }))
    .filter((s: any) => s.preparacao.nivel !== "preparada");

  type AcaoItem = { id: string; texto: string; href: string };
  type AcaoGrupo = { titulo: string; severidade: Severidade; verTodosHref: string; itens: AcaoItem[] };

  const gruposTodos: AcaoGrupo[] = [
    {
      titulo: "Técnico atrasado",
      severidade: "critico",
      verTodosHref: "/admin/agenda",
      itens: tecnicosAtrasados.map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — previsto para as ${s.hora_agendada?.slice(0, 5)}${
          (s.service_technicians ?? []).map((t: any) => t.profiles?.nome).filter(Boolean).length
            ? ` (${(s.service_technicians ?? []).map((t: any) => t.profiles?.nome).filter(Boolean).join(", ")})`
            : ""
        }, ainda não iniciado`,
        href: `/admin/servicos/${s.id}`,
      })),
    },
    {
      titulo: "Serviços por agendar",
      severidade: "atencao",
      verTodosHref: "/admin/servicos",
      itens: (porAgendar ?? []).map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — ${rotuloTipoServico(s.tipo)}${s.descricao ? `: ${s.descricao}` : ""}`,
        href: `/admin/servicos/${s.id}`,
      })),
    },
    {
      titulo: "Serviços de hoje sem técnico atribuído",
      severidade: "atencao",
      verTodosHref: "/admin/agenda",
      itens: semTecnicoHoje.map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — ${rotuloTipoServico(s.tipo)}${s.hora_agendada ? ` às ${s.hora_agendada.slice(0, 5)}` : ""}`,
        href: `/admin/servicos/${s.id}`,
      })),
    },
    {
      titulo: "Aguarda validação",
      severidade: "info",
      verTodosHref: "/admin/faturacao",
      itens: (aguardaValidacao ?? []).map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — ${s.descricao}`,
        href: "/admin/faturacao",
      })),
    },
    {
      titulo: "Validado — por faturar",
      severidade: "info",
      verTodosHref: "/admin/faturacao",
      itens: (porFaturarRows ?? []).map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — ${s.descricao}`,
        href: "/admin/faturacao",
      })),
    },
    {
      titulo: "Follow-up de orçamento — hoje",
      severidade: "atencao",
      verTodosHref: "/admin/orcamentos",
      itens: followupsHoje.map((o: any) => ({
        id: o.id,
        texto: `${o.clients?.nome} — enviado ${o.enviado_em ?? "—"}`,
        href: `/admin/orcamentos/${o.id}`,
      })),
    },
    {
      titulo: "Follow-up de orçamento — atrasado",
      severidade: "critico",
      verTodosHref: "/admin/orcamentos",
      itens: followupsAtrasados.map((o: any) => ({
        id: o.id,
        texto: `${o.clients?.nome} — enviado ${o.enviado_em ?? "—"}`,
        href: `/admin/orcamentos/${o.id}`,
      })),
    },
    {
      titulo: "Pedidos incompletos",
      severidade: "atencao",
      verTodosHref: "/admin/pedidos",
      itens: (pedidosIncompletos ?? []).map((p: any) => ({
        id: p.id,
        texto: `${p.clients?.nome} — ${p.descricao}`,
        href: "/admin/pedidos",
      })),
    },
    {
      titulo: "Serviços atrasados (dia já passou)",
      severidade: "critico",
      verTodosHref: "/admin/servicos",
      itens: (servicosAtrasadosPassado ?? []).map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — agendado para ${s.data_agendada}`,
        href: `/admin/servicos/${s.id}`,
      })),
    },
    {
      titulo: "Serviço ainda aberto (visita não fechada)",
      severidade: "critico",
      verTodosHref: "/admin/servicos",
      itens: servicosAbertosAntigos.map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — em curso desde antes de hoje, nunca fechado`,
        href: `/admin/servicos/${s.id}`,
      })),
    },
    {
      titulo: "OS rejeitada / correção necessária",
      severidade: "critico",
      verTodosHref: "/admin/servicos",
      itens: (correcoesNecessarias ?? []).map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — ${s.descricao}`,
        href: `/admin/servicos/${s.id}`,
      })),
    },
    {
      titulo: `Serviço futuro não preparado (até ${em3Dias})`,
      severidade: "atencao",
      verTodosHref: "/admin/servicos",
      itens: naoPreparados.map((s: any) => ({
        id: s.id,
        texto: `${s.clients?.nome} — ${s.data_agendada} · ${s.preparacao.motivos.join(", ")}`,
        href: `/admin/servicos/${s.id}`,
      })),
    },
  ];
  const grupos = gruposTodos.filter((g) => g.itens.length > 0);

  const totalAcoes = grupos.reduce((acc, g) => acc + g.itens.length, 0);
  const totalCriticos = grupos.filter((g) => g.severidade === "critico").reduce((acc, g) => acc + g.itens.length, 0);

  // --- Estado dos técnicos hoje -------------------------------------------
  const tecnicosHoje = (tecnicos ?? []).map((t: any) => {
    const servicosDoTecnico = servicosHoje
      .filter((s) => (s.service_technicians ?? []).some((st: any) => st.user_id === t.id))
      .sort((a, b) => (a.hora_agendada ?? "99:99").localeCompare(b.hora_agendada ?? "99:99"));

    const emCurso = servicosDoTecnico.find((s) => s.estado === "em_curso");
    const atrasado = servicosDoTecnico.find((s) => estaAtrasado(s, agoraHora));
    const atual = emCurso ?? atrasado ?? servicosDoTecnico.find((s) => s.estado === "agendado") ?? null;
    const proximo =
      servicosDoTecnico.find(
        (s) => s.id !== atual?.id && s.estado === "agendado" && (!atual?.hora_agendada || (s.hora_agendada ?? "") > atual.hora_agendada)
      ) ?? null;
    const concluidosDoTecnico = servicosDoTecnico.filter((s) => s.estado === "concluido" || s.estado === "aguarda_validacao").length;

    return { tecnico: t, atual, proximo, atrasado: Boolean(atrasado), totalHoje: servicosDoTecnico.length, concluidosDoTecnico };
  });

  // --- Progresso do dia ----------------------------------------------------
  const totalParaProgresso = agendadosHoje - naoAgendadosCancelados;
  const progressoConcluido = concluidosHojeDoAgendamento;
  const progressoPendente = Math.max(totalParaProgresso - progressoConcluido, 0);
  const pctConcluido = totalParaProgresso > 0 ? Math.round((progressoConcluido / totalParaProgresso) * 100) : 0;

  // --- Pedidos recentes (distinção visual Assistência vs Orçamento) -------
  // Classificação só de apresentação — "Orçamento" é o único tipo fixo que
  // não gera logo um Serviço (ver secção 6 do CLAUDE.md); qualquer outro
  // tipo (Agendamento/Manutenção/Instalação) é sempre um pedido de
  // assistência/serviço. Não cria nenhum estado novo, é só a cor/ícone.
  const PEDIDO_TIPO_CFG = {
    orcamento: { label: "Orçamento", cls: "bg-violet-500/15 text-violet-400", icon: Receipt },
    assistencia: { label: "Assistência", cls: "bg-sky-500/15 text-sky-400", icon: Wrench },
  } as const;
  const pedidosComTipo = (pedidosRecentes ?? []).map((p: any) => ({
    ...p,
    categoria: p.tipo === "Orçamento" ? ("orcamento" as const) : ("assistencia" as const),
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-white">Dashboard</h1>
      <p className="mb-6 text-sm text-neutral-400">Central operacional — o que precisa da sua atenção agora.</p>

      {/* Hero — os 4 números que respondem "como está o dia" num relance */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <HeroCard
          icon={AlertTriangle}
          label="Ação necessária"
          value={totalAcoes}
          tone={totalAcoes === 0 ? "ok" : totalCriticos > 0 ? "critico" : "atencao"}
          sub={totalCriticos > 0 ? `${totalCriticos} crítico${totalCriticos === 1 ? "" : "s"}` : totalAcoes === 0 ? "Tudo em dia" : "Sem urgências"}
          href="#acao-necessaria"
        />
        <HeroCard
          icon={CalendarClock}
          label="Agendados hoje"
          value={agendadosHoje}
          tone="neutro"
          sub={`${pctConcluido}% concluído`}
          href="/admin/agenda"
        />
        <HeroCard icon={CheckCircle2} label="Concluídos hoje" value={concluidosHojeCount ?? 0} tone="ok" href="/admin/servicos" />
        <HeroCard
          icon={Wallet}
          label="Faturado hoje"
          value={formatEuros(financeiroHoje.faturacao.totalFaturado)}
          tone="neutro"
          sub={`Por faturar: ${formatEuros(financeiroHoje.faturacao.totalPorFaturar)}`}
          href="/admin/faturacao"
        />
      </section>

      {/* Ação necessária — agrupada por severidade, não uma parede amarela única */}
      <section className="mb-8" id="acao-necessaria">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Ação necessária</h2>
        </div>
        {totalAcoes === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Tudo em dia — sem situações pendentes.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(["critico", "atencao", "info"] as Severidade[]).map((sev) => {
              const gruposSev = grupos.filter((g) => g.severidade === sev);
              if (gruposSev.length === 0) return null;
              const cfg = SEVERIDADE_CFG[sev];
              const Icon = cfg.icon;
              const totalSev = gruposSev.reduce((acc, g) => acc + g.itens.length, 0);
              return (
                <div key={sev} className={`rounded-xl border p-4 ${cfg.card}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.iconColor}`} aria-hidden="true" />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-200">{cfg.label}</h3>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.badge}`}>{totalSev}</span>
                  </div>
                  <div className="space-y-3">
                    {gruposSev.map((g) => (
                      <div key={g.titulo}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h4 className="text-[11px] font-semibold text-neutral-400">{g.titulo}</h4>
                          <span className="shrink-0 text-[11px] text-neutral-500">{g.itens.length}</span>
                        </div>
                        <div className="space-y-1">
                          {g.itens.slice(0, 3).map((item) => (
                            <Link
                              key={item.id}
                              href={item.href}
                              className="block truncate rounded-md bg-neutral-950/40 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-950/70 hover:text-white"
                              title={item.texto}
                            >
                              {item.texto}
                            </Link>
                          ))}
                          {g.itens.length > 3 && (
                            <Link
                              href={g.verTodosHref}
                              className="flex items-center gap-0.5 px-2.5 py-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-300"
                            >
                              +{g.itens.length - 3} mais <ChevronRight className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* O que está a acontecer hoje */}
      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="mb-3 text-sm font-bold text-white">Agenda de hoje</h2>
          {servicosHoje.length === 0 ? (
            <p className="text-sm text-neutral-500">Sem serviços agendados para hoje.</p>
          ) : (
            <div className="space-y-1.5">
              {servicosHoje.map((s: any) => {
                const atrasado = estaAtrasado(s, agoraHora);
                const tecnicosNomes = (s.service_technicians ?? []).map((t: any) => t.profiles?.nome).filter(Boolean).join(", ");
                return (
                  <Link
                    key={s.id}
                    href={`/admin/servicos/${s.id}`}
                    className={`flex items-center gap-3 rounded-md p-2.5 text-sm hover:bg-neutral-800 ${
                      atrasado ? "border border-red-500/30 bg-red-500/10" : "border border-transparent"
                    }`}
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-neutral-400">
                      {s.hora_agendada ? s.hora_agendada.slice(0, 5) : "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-200">
                      {s.clients?.nome} <span className="text-neutral-500">· {rotuloTipoServico(s.tipo)}</span>
                    </span>
                    <span className="shrink-0 truncate text-xs text-neutral-500">{tecnicosNomes || "sem técnico"}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_COLOR[s.estado] ?? "bg-neutral-800 text-neutral-300"}`}>
                      {atrasado ? "Atrasado" : ESTADO_LABEL[s.estado] ?? s.estado}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-white">
            <Users className="h-4 w-4 text-neutral-400" aria-hidden="true" /> Técnicos hoje
          </h2>
          {tecnicosHoje.length === 0 ? (
            <p className="text-sm text-neutral-500">Sem técnicos registados.</p>
          ) : (
            <div className="space-y-2">
              {tecnicosHoje.map(({ tecnico, atual, proximo, atrasado, totalHoje, concluidosDoTecnico }) => (
                <div key={tecnico.id} className="rounded-md border border-neutral-800 p-2.5 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-neutral-100">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-bold text-neutral-300">
                        {tecnico.nome?.slice(0, 1)?.toUpperCase()}
                      </span>
                      {tecnico.nome}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {atrasado && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Atrasado</span>}
                      {totalHoje > 0 && (
                        <span className="text-[10px] font-medium text-neutral-500">
                          {concluidosDoTecnico}/{totalHoje}
                        </span>
                      )}
                    </span>
                  </div>
                  {totalHoje > 0 && (
                    <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.round((concluidosDoTecnico / totalHoje) * 100)}%` }}
                      />
                    </div>
                  )}
                  {atual ? (
                    <Link href={`/admin/servicos/${atual.id}`} className="block text-xs text-neutral-400 hover:text-neutral-200">
                      Atual: {atual.clients?.nome} · {rotuloTipoServico(atual.tipo)}
                      {atual.hora_agendada ? ` às ${atual.hora_agendada.slice(0, 5)}` : ""} · {ESTADO_LABEL[atual.estado] ?? atual.estado}
                    </Link>
                  ) : (
                    <p className="text-xs text-neutral-500">{totalHoje === 0 ? "Sem serviços hoje" : "Sem serviço em curso"}</p>
                  )}
                  {proximo && (
                    <Link href={`/admin/servicos/${proximo.id}`} className="mt-0.5 block text-xs text-neutral-500 hover:text-neutral-300">
                      Próximo: {proximo.clients?.nome} às {proximo.hora_agendada?.slice(0, 5)}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Progresso do dia + Pedidos recentes (com distinção Assistência/Orçamento) */}
      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="mb-3 text-sm font-bold text-white">Progresso do dia</h2>
          {totalParaProgresso === 0 ? (
            <p className="text-sm text-neutral-500">Sem serviços planeados para hoje.</p>
          ) : (
            <div className="flex items-center gap-5">
              <ProgressoDiaDonut concluidos={progressoConcluido} pendentes={progressoPendente} cancelados={naoAgendadosCancelados} pct={pctConcluido} />
              <div className="space-y-1.5 text-xs">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Circle className="h-2.5 w-2.5 fill-current text-emerald-500" aria-hidden="true" />
                  <b className="font-semibold text-neutral-100">{progressoConcluido}</b> concluídos
                </span>
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Circle className="h-2.5 w-2.5 fill-current text-amber-500" aria-hidden="true" />
                  <b className="font-semibold text-neutral-100">{progressoPendente}</b> por realizar
                </span>
                {naoAgendadosCancelados > 0 && (
                  <span className="flex items-center gap-1.5 text-neutral-500">
                    <Circle className="h-2.5 w-2.5 fill-current text-neutral-600" aria-hidden="true" />
                    {naoAgendadosCancelados} cancelados (fora da conta)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Pedidos recentes</h2>
            <Link href="/admin/pedidos" className="flex items-center gap-0.5 text-xs font-medium text-neutral-500 hover:text-neutral-300">
              Ver todos <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          {pedidosComTipo.length === 0 ? (
            <p className="text-sm text-neutral-500">Sem pedidos novos.</p>
          ) : (
            <div className="space-y-1.5">
              {pedidosComTipo.map((p: any) => {
                const cfg = PEDIDO_TIPO_CFG[p.categoria as keyof typeof PEDIDO_TIPO_CFG];
                const TipoIcon = cfg.icon;
                return (
                  <Link
                    key={p.id}
                    href="/admin/pedidos"
                    className="flex items-center gap-3 rounded-md border border-transparent p-2.5 text-sm hover:bg-neutral-800"
                  >
                    <span className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[10px] font-bold ${cfg.cls}`}>
                      <TipoIcon className="h-3 w-3" aria-hidden="true" /> {cfg.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-200">{p.clients?.nome}</span>
                    <span className="shrink-0 font-mono text-xs text-neutral-500">{p.codigo}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Indicadores gerais (inclui o financeiro operacional) */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-white">Indicadores de hoje</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Por realizar hoje" value={pendentesHoje.length} />
          <StatCard label="Pedidos novos" value={pedidosNovos ?? 0} href="/admin/pedidos" />
          <StatCard label="Orçamentos em aberto" value={orcamentosAbertos?.length ?? 0} href="/admin/orcamentos" />
          <StatCard label="Recebido hoje" value={formatEuros(financeiroHoje.faturacao.totalRecebido)} href="/admin/faturacao" />
        </div>
      </section>
    </div>
  );
}

type Tone = "ok" | "atencao" | "critico" | "neutro";
const HERO_TONE_CFG: Record<Tone, { ring: string; icon: string; value: string }> = {
  ok: { ring: "border-emerald-500/25 bg-emerald-500/[0.06]", icon: "text-emerald-400", value: "text-white" },
  atencao: { ring: "border-amber-500/25 bg-amber-500/[0.06]", icon: "text-amber-400", value: "text-white" },
  critico: { ring: "border-red-500/25 bg-red-500/[0.06]", icon: "text-red-400", value: "text-white" },
  neutro: { ring: "border-neutral-800 bg-neutral-900", icon: "text-neutral-400", value: "text-white" },
};

function HeroCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  href,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string | number;
  sub?: string;
  tone: Tone;
  href: string;
}) {
  const cfg = HERO_TONE_CFG[tone];
  return (
    <Link href={href} className={`block rounded-2xl border p-4 transition-colors hover:brightness-110 sm:p-5 ${cfg.ring}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
        <Icon className={`h-4 w-4 shrink-0 ${cfg.icon}`} aria-hidden="true" />
      </div>
      <div className={`text-2xl font-bold tabular-nums sm:text-3xl ${cfg.value}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </Link>
  );
}

function StatCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const conteudo = (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600">
      <div className="mb-2 text-xs font-medium text-neutral-400">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{conteudo}</Link> : conteudo;
}
