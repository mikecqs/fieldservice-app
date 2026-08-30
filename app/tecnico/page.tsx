import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AtivarNotificacoes } from "./AtivarNotificacoes";
import { Badge } from "@/components/ui/Badge";

// Repara na tabela usada: `services_technician_view`, não `services`.
// A tabela services nem sequer tem policy de SELECT para TECHNICIAN — se
// esta página fosse alterada por engano para ler de "services" diretamente,
// a query simplesmente devolveria zero linhas, nunca dados de mais.
export default async function AgendaTecnicoPage() {
  const supabase = createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: servicos } = await supabase
    .from("services_technician_view")
    .select("*")
    .order("data_agendada", { ascending: true })
    .order("hora_agendada", { ascending: true });

  // Fechados ou à espera de validação já não têm nada a fazer pelo técnico —
  // ficam no fundo da lista para não competirem por atenção com o que ainda
  // está por resolver, mas continuam visíveis (histórico do que fez).
  const FECHADOS = ["concluido", "aguarda_validacao", "nao_realizado", "cancelado"];
  const ativos = (servicos ?? []).filter((s: any) => !FECHADOS.includes(s.estado));
  const fechados = (servicos ?? []).filter((s: any) => FECHADOS.includes(s.estado));

  // Alerta de possível atraso: está num serviço em curso e o próximo já
  // está a chegar (ou já passou da hora) — usa só dados já disponíveis
  // (nunca GPS/tracking), como pedido.
  const emCurso = ativos.find((s: any) => s.estado === "em_curso");
  let proximoAtrasoAviso: string | null = null;
  if (emCurso) {
    const indice = ativos.findIndex((s: any) => s.id === emCurso.id);
    const proximo = ativos
      .slice(indice + 1)
      .find((s: any) => s.estado === "agendado" && s.data_agendada === hoje && s.hora_agendada);
    if (proximo) {
      const agora = new Date();
      const [h, m] = proximo.hora_agendada.split(":").map(Number);
      const previsto = new Date();
      previsto.setHours(h, m, 0, 0);
      const minutosPara = (previsto.getTime() - agora.getTime()) / 60000;
      if (minutosPara <= 30) {
        proximoAtrasoAviso = `O seu próximo serviço começa às ${proximo.hora_agendada.slice(0, 5)} e o serviço atual ainda está em curso.`;
      }
    }
  }

  return (
    <div className="px-4 py-4">
      <AtivarNotificacoes />
      {proximoAtrasoAviso && (
        <div className="mb-4 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-medium text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{proximoAtrasoAviso}</span>
        </div>
      )}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-400">A minha agenda</h2>
      {(!servicos || servicos.length === 0) && (
        <p className="py-10 text-center text-sm text-neutral-500">Sem serviços atribuídos.</p>
      )}
      <div className="space-y-3">
        {ativos.map((s: any) => (
          <ServicoCard key={s.id} s={s} hoje={hoje} />
        ))}
      </div>

      {fechados.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-neutral-500">Fechados</h2>
          <div className="space-y-3 opacity-60">
            {fechados.map((s: any) => (
              <ServicoCard key={s.id} s={s} hoje={hoje} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ServicoCard({ s, hoje }: { s: any; hoje: string }) {
  return (
    <Link
      href={`/tecnico/servico/${s.id}`}
      className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm active:bg-neutral-800"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-neutral-100">{s.hora_agendada?.slice(0, 5) ?? "—"}</span>
        <div className="flex items-center gap-1.5">
          {s.data_agendada === hoje && (
            <span className="rounded bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-400">Hoje</span>
          )}
          <Badge estado={s.estado} />
        </div>
      </div>
      <div className="text-base font-semibold text-neutral-100">{s.cliente_nome}</div>
      {s.estado === "correcao_necessaria" && s.motivo_correcao ? (
        <div className="flex items-center gap-1.5 text-sm font-medium text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Correção: {s.motivo_correcao}
        </div>
      ) : s.detalhes_visiveis ? (
        <div className="text-sm text-neutral-400">{s.descricao}</div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Detalhes disponíveis quando este for o próximo serviço
        </div>
      )}
    </Link>
  );
}
