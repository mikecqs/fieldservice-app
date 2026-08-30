import Link from "next/link";
import { estadoOperacionalPedido, ESTADO_PEDIDO_LABEL } from "@/lib/pedido-estado";
import { ESTADO_LABEL as SERVICO_ESTADO_LABEL, ESTADO_COLOR as SERVICO_ESTADO_COLOR } from "@/app/admin/servicos/estados";

// O tipo exato devolvido por obterDetalhePedido() depende de como o
// supabase-js infere as relações aninhadas (este projeto não usa tipos
// gerados da BD, como o resto do módulo de Pedidos) — aceitar `any` aqui
// evita um type-cast frágil sempre que a forma da query mudar um pouco.
export type PedidoDetalhe = any;

// Conteúdo puramente de consulta (sem forms de ação) — percurso completo do
// pedido: Pedido → Orçamento (se existir) → Serviço/OS (se existir), sempre
// com o histórico já existente (budget_events/service_events), nunca um
// sistema de histórico novo. Usado tanto pela página completa
// (/admin/pedidos/[id]) como pelo popup de consulta rápida da lista — por
// isso não inclui as ações (Converter/Arquivar/Marcar info), que continuam
// só na página completa.
export function PedidoDetalheConteudo({
  detalhe,
  linkClienteAtivo = true,
  acoes,
}: {
  detalhe: PedidoDetalhe;
  linkClienteAtivo?: boolean;
  // Slot opcional para as ações do pedido (Converter/Arquivar/Marcar info) —
  // só a página completa as passa; o popup de consulta rápida fica só
  // leitura, com um link para "abrir página completa" para quem quiser agir.
  acoes?: React.ReactNode;
}) {
  const { pedido, budget, service, budgetEvents, serviceEvents } = detalhe;
  const estadoOperacional = estadoOperacionalPedido(pedido, budget ?? undefined, service ?? undefined);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">{pedido.codigo}</span>
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">{pedido.tipo}</span>
            {pedido.info_falta && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">Falta info</span>
            )}
          </div>
          <h3 className="mt-2 text-base font-bold text-white">
            {linkClienteAtivo ? (
              <Link href={`/admin/clientes/${pedido.clients?.id}`} className="hover:underline">
                {pedido.clients?.nome}
              </Link>
            ) : (
              pedido.clients?.nome
            )}
            {pedido.clients?.codigo && <span className="ml-2 text-xs font-normal text-neutral-500">{pedido.clients.codigo}</span>}
          </h3>
          <p className="text-xs text-neutral-500">
            {pedido.clients?.telefone} {pedido.clients?.email ? `· ${pedido.clients?.email}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${estadoOperacional.cls}`}>{estadoOperacional.label}</span>
      </div>

      <div className="mb-3 rounded-md bg-neutral-800 p-3 text-sm text-neutral-300">
        <div className="mb-1 text-[10px] font-semibold uppercase text-neutral-500">Morada</div>
        {pedido.client_addresses ? `${pedido.client_addresses.label}: ${pedido.client_addresses.endereco}` : "—"}
      </div>

      <p className="mb-2 text-sm text-neutral-200">{pedido.descricao}</p>
      <p className="mb-4 text-xs text-neutral-500">
        Origem: {pedido.origem} · Estado do pedido: {ESTADO_PEDIDO_LABEL[pedido.estado] ?? pedido.estado} · Criado em{" "}
        {new Date(pedido.created_at).toLocaleString("pt-PT")}
      </p>

      {acoes && <div className="mb-4">{acoes}</div>}

      {/* Pedido → Orçamento */}
      <div className="mb-3 rounded-lg border border-neutral-800 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Orçamento</h4>
          {budget && (
            <Link href={`/admin/orcamentos/${budget.id}`} className="text-xs text-neutral-400 underline hover:text-white">
              Ver orçamento →
            </Link>
          )}
        </div>
        {budget ? (
          <>
            <p className="mb-2 text-sm text-neutral-200">
              Nº {budget.numero} ·{" "}
              {budget.estado === "aceite" ? "Aceite" : budget.estado === "recusado" ? "Recusado" : budget.estado === "cancelado" ? "Cancelado" : "Em curso"}
            </p>
            <HistoricoEventos eventos={budgetEvents} />
          </>
        ) : (
          <p className="text-xs text-neutral-500">Ainda não existe orçamento para este pedido.</p>
        )}
      </div>

      {/* Orçamento → Serviço/OS (agendamento, estado operacional, conclusão) */}
      <div className="rounded-lg border border-neutral-800 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Serviço / OS</h4>
          {service && (
            <Link href={`/admin/servicos/${service.id}`} className="text-xs text-neutral-400 underline hover:text-white">
              Ver serviço →
            </Link>
          )}
        </div>
        {service ? (
          <>
            <p className="mb-2 text-sm text-neutral-200">
              {service.tipo} ·{" "}
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SERVICO_ESTADO_COLOR[service.estado] ?? "bg-neutral-800 text-neutral-300"}`}>
                {SERVICO_ESTADO_LABEL[service.estado] ?? service.estado}
              </span>
            </p>
            <HistoricoEventos eventos={serviceEvents} />
          </>
        ) : (
          <p className="text-xs text-neutral-500">Ainda não existe serviço/OS para este pedido.</p>
        )}
      </div>
    </div>
  );
}

function HistoricoEventos({ eventos }: { eventos: { id: string; tipo: string; descricao: string; created_at: string }[] }) {
  if (eventos.length === 0) {
    return <p className="text-xs text-neutral-500">Ainda sem histórico.</p>;
  }
  return (
    <div className="space-y-2 border-l border-neutral-800 pl-3">
      {eventos.map((e) => (
        <div key={e.id} className="text-xs">
          <div className="text-neutral-300">{e.descricao}</div>
          <div className="text-neutral-600">{new Date(e.created_at).toLocaleString("pt-PT")}</div>
        </div>
      ))}
    </div>
  );
}
