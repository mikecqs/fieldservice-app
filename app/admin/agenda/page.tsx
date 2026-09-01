import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { ESTADO_LABEL } from "../servicos/estados";
import { toISO, parseISO, addDays, mondayOf, monthGridRange, MESES } from "@/lib/agenda-dates";
import { calcularPreparacao, type NivelPreparacao } from "@/lib/preparacao";
import { ESTADOS_SERVICO_POR_AGENDAR } from "@/lib/operacional";
import { AgendaClient } from "./AgendaClient";
import type { ServicoAgenda } from "./ServicoModal";

type Servico = ServicoAgenda & {
  client_addresses: { endereco: string } | null;
  preparacaoNivel?: NivelPreparacao;
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { view?: string; data?: string };
}) {
  const supabase = createClient();
  const view = searchParams.view === "dia" || searchParams.view === "mes" ? searchParams.view : "semana";
  const refDate = searchParams.data ? parseISO(searchParams.data) : new Date();

  let desde: Date, ate: Date, dias: Date[];
  if (view === "dia") {
    desde = ate = refDate;
    dias = [refDate];
  } else if (view === "mes") {
    ({ desde, ate } = monthGridRange(refDate));
    dias = [];
  } else {
    desde = mondayOf(refDate);
    ate = addDays(desde, 6);
    dias = Array.from({ length: 7 }, (_, i) => addDays(desde, i));
  }

  const organizationId = await getOrgId();

  const [{ data: servicos }, { data: pendentes }, { data: comprasPendentes }, { data: clientes }, { data: tecnicos }, { data: pedidosAbertos }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, tipo, descricao, estado, faturacao_estado, prioridade, notas, client_id, data_agendada, hora_agendada, hora_fim_agendada, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id, profiles(nome))"
      )
      .gte("data_agendada", toISO(desde))
      .lte("data_agendada", toISO(ate))
      .not("data_agendada", "is", null)
      .order("hora_agendada"),
    supabase
      .from("services")
      .select("id, tipo, descricao, estado, client_id, clients(nome)")
      .is("data_agendada", null)
      .in("estado", ESTADOS_SERVICO_POR_AGENDAR)
      .order("created_at", { ascending: false }),
    supabase.from("purchases").select("service_id").in("estado", ["por_encomendar", "encomendada", "parcial"]),
    supabase
      .from("clients")
      .select("id, nome, nif, telefone, client_addresses(id, label, endereco)")
      .eq("organization_id", organizationId)
      .order("nome"),
    supabase.from("profiles").select("id, nome").eq("organization_id", organizationId).eq("role", "TECHNICIAN").order("nome"),
    supabase
      .from("requests")
      .select("id, tipo, descricao, client_id, clients(nome)")
      .eq("organization_id", organizationId)
      .in("estado", ["novo", "orcamento"])
      .order("created_at", { ascending: false }),
  ]);

  const materialPendentePorServico = new Set((comprasPendentes ?? []).map((c: any) => c.service_id));

  const servicosPorDia = new Map<string, Servico[]>();
  for (const s of (servicos ?? []) as any[]) {
    const preparacaoNivel = calcularPreparacao({
      temTecnico: (s.service_technicians ?? []).length > 0,
      morada: s.client_addresses?.endereco,
      temContacto: !!(s.clients?.telefone || s.clients?.email),
      descricao: s.descricao,
      dataAgendada: s.data_agendada,
      horaAgendada: s.hora_agendada,
      materialBloqueando: materialPendentePorServico.has(s.id),
    }).nivel;
    const servico: Servico = { ...s, preparacaoNivel };
    const lista = servicosPorDia.get(s.data_agendada) ?? [];
    lista.push(servico);
    servicosPorDia.set(s.data_agendada, lista);
  }

  const hoje = toISO(new Date());
  const linkView = (v: string) => `/admin/agenda?view=${v}&data=${toISO(refDate)}`;
  const passo = view === "dia" ? 1 : view === "mes" ? 30 : 7;
  const anterior = view === "mes" ? new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1) : addDays(refDate, -passo);
  const seguinte = view === "mes" ? new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1) : addDays(refDate, passo);

  const titulo =
    view === "dia"
      ? `${refDate.getDate()} de ${MESES[refDate.getMonth()]} de ${refDate.getFullYear()}`
      : view === "mes"
      ? `${MESES[refDate.getMonth()]} de ${refDate.getFullYear()}`
      : `${toISO(mondayOf(refDate))} a ${toISO(addDays(mondayOf(refDate), 6))}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Agenda</h1>
          <p className="mt-0.5 text-sm text-neutral-400">{titulo}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/agenda?view=${view}&data=${toISO(anterior)}`} className="rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            ←
          </Link>
          <Link href={`/admin/agenda?view=${view}&data=${hoje}`} className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            Hoje
          </Link>
          <Link href={`/admin/agenda?view=${view}&data=${toISO(seguinte)}`} className="rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            →
          </Link>
          <div className="ml-2 flex overflow-hidden rounded-md border border-neutral-700">
            {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([v, label]) => (
              <Link
                key={v}
                href={linkView(v)}
                className={`px-3 py-1.5 text-sm ${view === v ? "bg-white text-neutral-950" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <AgendaClient
        view={view}
        refDateIso={toISO(refDate)}
        dias={dias.map((d) => toISO(d))}
        servicosPorDiaEntries={Array.from(servicosPorDia.entries())}
        clientes={clientes ?? []}
        tecnicos={tecnicos ?? []}
        pedidosAbertos={(pedidosAbertos ?? []) as any}
        servicosPendentes={(pendentes ?? []) as any}
      />

      {(pendentes ?? []).length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-400">
            Pendentes de agendamento · {(pendentes ?? []).length}
          </h2>
          <div className="space-y-1.5">
            {(pendentes ?? []).map((s: any) => (
              <Link
                key={s.id}
                href={`/admin/servicos/${s.id}`}
                className="block rounded-md border border-amber-500/20 bg-neutral-900 p-2.5 text-sm text-amber-300 hover:bg-amber-500/15"
              >
                {s.clients?.nome} — {s.tipo} · {s.descricao} · <span className="text-xs">{ESTADO_LABEL[s.estado]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
