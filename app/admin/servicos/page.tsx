import Link from "next/link";
import { Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ESTADO_LABEL, ESTADO_COLOR } from "./estados";
import { calcularPreparacao, PREPARACAO_BADGE } from "@/lib/preparacao";

const ESTADOS_POR_EXECUTAR = ["por_agendar", "agendado", "nova_visita", "correcao_necessaria"];

export default async function ServicosPage() {
  const supabase = createClient();
  const [{ data: servicos }, { data: comprasPendentes }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, tipo, descricao, prioridade, estado, data_agendada, hora_agendada, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("purchases").select("service_id").in("estado", ["por_encomendar", "encomendada", "parcial"]),
  ]);

  const materialPendentePorServico = new Set((comprasPendentes ?? []).map((c: any) => c.service_id));

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Serviços</h1>
          <p className="mt-0.5 text-sm text-neutral-400">Ordens de serviço, desde agendamento até conclusão.</p>
        </div>
        {/* Onda 3 (Etapa 9) — /admin/servicos/novo deixou de existir como
            ponto de criação independente (decisão C da auditoria): criar um
            serviço passa sempre pelo fluxo de Pedido, que já cobre o mesmo
            caso (tipo "Agendamento" cria o serviço de imediato) e acrescenta
            rastreabilidade (Origem) que este caminho nunca tinha. */}
        <Link
          href="/admin/pedidos/novo"
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Novo serviço
        </Link>
      </div>

      <div className="space-y-2">
        {(servicos ?? []).map((s: any) => {
          const prep = calcularPreparacao({
            temTecnico: (s.service_technicians ?? []).length > 0,
            morada: s.client_addresses?.endereco,
            temContacto: !!(s.clients?.telefone || s.clients?.email),
            descricao: s.descricao,
            dataAgendada: s.data_agendada,
            horaAgendada: s.hora_agendada,
            materialBloqueando: materialPendentePorServico.has(s.id),
          });
          const badge = PREPARACAO_BADGE[prep.nivel];
          const mostrarPreparacao = ESTADOS_POR_EXECUTAR.includes(s.estado);
          return (
          <Link
            key={s.id}
            href={`/admin/servicos/${s.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {mostrarPreparacao && (
                  <span title={prep.motivos.join(", ")}>
                    <Circle className={`h-2.5 w-2.5 fill-current ${badge.dotColor}`} aria-hidden="true" />
                  </span>
                )}
                <span className="font-medium text-neutral-100">{s.clients?.nome}</span>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">{s.tipo}</span>
                {s.prioridade === "alta" && (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Alta prioridade</span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-neutral-400">{s.descricao}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {s.data_agendada && (
                <span className="text-xs text-neutral-500">
                  {s.data_agendada} {s.hora_agendada?.slice(0, 5)}
                </span>
              )}
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[s.estado] ?? ""}`}>
                {ESTADO_LABEL[s.estado] ?? s.estado}
              </span>
            </div>
          </Link>
          );
        })}
        {(servicos ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">Ainda sem serviços.</p>
        )}
      </div>
    </div>
  );
}
