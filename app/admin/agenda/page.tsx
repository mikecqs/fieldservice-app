import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ESTADO_LABEL, ESTADO_COLOR } from "../servicos/estados";
import { toISO, parseISO, addDays, mondayOf, monthGridRange, DIAS_SEMANA, MESES } from "@/lib/agenda-dates";
import { calcularPreparacao, PREPARACAO_BADGE, type NivelPreparacao } from "@/lib/preparacao";

const HORA_INICIO_GRELHA = 7;
const HORA_FIM_GRELHA = 20;
const ALTURA_HORA = 48; // px

type Servico = {
  id: string;
  tipo: string;
  descricao: string;
  estado: string;
  data_agendada: string;
  hora_agendada: string | null;
  hora_fim_agendada: string | null;
  clients: { nome: string } | null;
  service_technicians: { profiles: { nome: string } | null }[];
  preparacaoNivel?: NivelPreparacao;
};

function minutosDoDia(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function EventoResumo({ s }: { s: Servico }) {
  const tecnicos = s.service_technicians.map((t) => t.profiles?.nome).filter(Boolean).join(", ");
  const emoji = s.preparacaoNivel ? PREPARACAO_BADGE[s.preparacaoNivel].emoji : null;
  return (
    <Link
      href={`/admin/servicos/${s.id}`}
      className={`block rounded border-l-4 border-current px-1.5 py-1 text-[11px] leading-tight ${ESTADO_COLOR[s.estado] ?? "bg-slate-100 text-slate-600"}`}
    >
      <div className="font-semibold">
        {emoji && <span className="mr-0.5">{emoji}</span>}
        {s.hora_agendada?.slice(0, 5)}
        {s.hora_fim_agendada ? `–${s.hora_fim_agendada.slice(0, 5)}` : ""} · {s.clients?.nome}
      </div>
      <div className="truncate opacity-80">{s.tipo}{tecnicos ? ` · ${tecnicos}` : ""}</div>
    </Link>
  );
}

function GrelhaHoraria({ dias, servicosPorDia }: { dias: Date[]; servicosPorDia: Map<string, Servico[]> }) {
  const horas = Array.from({ length: HORA_FIM_GRELHA - HORA_INICIO_GRELHA }, (_, i) => HORA_INICIO_GRELHA + i);
  const alturaTotal = horas.length * ALTURA_HORA;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="flex min-w-[600px]">
        <div className="w-14 shrink-0 border-r border-slate-100 pt-8">
          {horas.map((h) => (
            <div key={h} style={{ height: ALTURA_HORA }} className="border-t border-slate-100 pl-1 text-[10px] text-slate-400">
              {h}:00
            </div>
          ))}
        </div>
        {dias.map((dia) => {
          const iso = toISO(dia);
          const servicos = (servicosPorDia.get(iso) ?? []).filter((s) => s.hora_agendada);
          const hoje = iso === toISO(new Date());
          return (
            <div key={iso} className="flex-1 border-r border-slate-100 last:border-r-0">
              <div className={`sticky top-0 border-b border-slate-100 px-1 py-1.5 text-center text-xs ${hoje ? "bg-indigo-50 font-bold text-indigo-800" : "text-slate-500"}`}>
                {DIAS_SEMANA[dia.getDay() === 0 ? 6 : dia.getDay() - 1]} {dia.getDate()}
              </div>
              <div className="relative" style={{ height: alturaTotal }}>
                {horas.map((h) => (
                  <div key={h} className="border-t border-slate-50" style={{ height: ALTURA_HORA }} />
                ))}
                {servicos.map((s) => {
                  const inicio = Math.max(minutosDoDia(s.hora_agendada!), HORA_INICIO_GRELHA * 60);
                  const fimBruto = s.hora_fim_agendada ? minutosDoDia(s.hora_fim_agendada) : inicio + 60;
                  const fim = Math.min(Math.max(fimBruto, inicio + 20), HORA_FIM_GRELHA * 60);
                  const top = ((inicio - HORA_INICIO_GRELHA * 60) / 60) * ALTURA_HORA;
                  const altura = ((fim - inicio) / 60) * ALTURA_HORA;
                  return (
                    <div key={s.id} className="absolute left-0.5 right-0.5" style={{ top, height: altura }}>
                      <EventoResumo s={s} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarioMes({ refDate, servicosPorDia }: { refDate: Date; servicosPorDia: Map<string, Servico[]> }) {
  const { desde, ate } = monthGridRange(refDate);
  const dias: Date[] = [];
  for (let d = desde; d <= ate; d = addDays(d, 1)) dias.push(d);
  const mesAtual = refDate.getMonth();

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[700px]">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold text-slate-500">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const iso = toISO(dia);
          const servicos = (servicosPorDia.get(iso) ?? []).slice().sort((a, b) => (a.hora_agendada ?? "").localeCompare(b.hora_agendada ?? ""));
          const foraDoMes = dia.getMonth() !== mesAtual;
          const hoje = iso === toISO(new Date());
          return (
            <div key={iso} className={`min-h-[92px] border-b border-r border-slate-100 p-1 ${foraDoMes ? "bg-slate-50/60" : ""}`}>
              <Link
                href={`/admin/agenda?view=dia&data=${iso}`}
                className={`mb-1 inline-block rounded px-1.5 text-xs ${hoje ? "bg-indigo-900 font-bold text-white" : foraDoMes ? "text-slate-300" : "text-slate-600"}`}
              >
                {dia.getDate()}
              </Link>
              <div className="space-y-0.5">
                {servicos.slice(0, 3).map((s) => (
                  <EventoResumo key={s.id} s={s} />
                ))}
                {servicos.length > 3 && (
                  <Link href={`/admin/agenda?view=dia&data=${iso}`} className="block text-[10px] text-indigo-700 hover:underline">
                    +{servicos.length - 3} mais
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

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

  const [{ data: servicos }, { data: pendentes }, { data: comprasPendentes }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, tipo, descricao, estado, data_agendada, hora_agendada, hora_fim_agendada, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id, profiles(nome))"
      )
      .gte("data_agendada", toISO(desde))
      .lte("data_agendada", toISO(ate))
      .not("data_agendada", "is", null)
      .order("hora_agendada"),
    supabase
      .from("services")
      .select("id, tipo, descricao, estado, clients(nome)")
      .is("data_agendada", null)
      .in("estado", ["por_agendar", "nova_visita"])
      .order("created_at", { ascending: false }),
    supabase.from("purchases").select("service_id").in("estado", ["por_encomendar", "encomendada", "parcial"]),
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
          <h1 className="text-xl font-bold text-slate-900">Agenda</h1>
          <p className="mt-0.5 text-sm text-slate-500">{titulo}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/agenda?view=${view}&data=${toISO(anterior)}`} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            ←
          </Link>
          <Link href={`/admin/agenda?view=${view}&data=${hoje}`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Hoje
          </Link>
          <Link href={`/admin/agenda?view=${view}&data=${toISO(seguinte)}`} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            →
          </Link>
          <div className="ml-2 flex overflow-hidden rounded-md border border-slate-300">
            {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([v, label]) => (
              <Link
                key={v}
                href={linkView(v)}
                className={`px-3 py-1.5 text-sm ${view === v ? "bg-indigo-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {view === "mes" ? (
        <CalendarioMes refDate={refDate} servicosPorDia={servicosPorDia} />
      ) : (
        <GrelhaHoraria dias={dias} servicosPorDia={servicosPorDia} />
      )}

      {(pendentes ?? []).length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
            Pendentes de agendamento · {(pendentes ?? []).length}
          </h2>
          <div className="space-y-1.5">
            {(pendentes ?? []).map((s: any) => (
              <Link
                key={s.id}
                href={`/admin/servicos/${s.id}`}
                className="block rounded-md border border-amber-200 bg-white p-2.5 text-sm text-amber-900 hover:bg-amber-100"
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
