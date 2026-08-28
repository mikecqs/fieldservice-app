import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="px-4 py-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">A minha agenda</h2>
      {(!servicos || servicos.length === 0) && (
        <p className="py-10 text-center text-sm text-slate-400">Sem serviços atribuídos.</p>
      )}
      <div className="space-y-3">
        {ativos.map((s: any) => (
          <ServicoCard key={s.id} s={s} hoje={hoje} />
        ))}
      </div>

      {fechados.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-slate-400">Fechados</h2>
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
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-indigo-900">{s.hora_agendada?.slice(0, 5) ?? "—"}</span>
        <div className="flex items-center gap-1.5">
          {s.data_agendada === hoje && (
            <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Hoje</span>
          )}
          <EstadoBadge estado={s.estado} />
        </div>
      </div>
      <div className="text-base font-semibold text-slate-800">{s.cliente_nome}</div>
      {s.estado === "correcao_necessaria" && s.motivo_correcao ? (
        <div className="text-sm font-medium text-red-700">⚠️ Correção: {s.motivo_correcao}</div>
      ) : s.detalhes_visiveis ? (
        <div className="text-sm text-slate-500">{s.descricao}</div>
      ) : (
        <div className="text-sm text-slate-400">🔒 Detalhes disponíveis quando este for o próximo serviço</div>
      )}
    </Link>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, [string, string]> = {
    agendado: ["Agendado", "bg-indigo-100 text-indigo-800"],
    em_curso: ["Em curso", "bg-amber-100 text-amber-800"],
    aguarda_validacao: ["Aguarda validação", "bg-amber-100 text-amber-800"],
    concluido: ["Concluído", "bg-emerald-100 text-emerald-800"],
    correcao_necessaria: ["Correção necessária", "bg-red-100 text-red-800"],
    nova_visita: ["Nova visita", "bg-orange-100 text-orange-800"],
    nao_realizado: ["Não realizado", "bg-red-100 text-red-700"],
  };
  const [label, cls] = map[estado] ?? [estado, "bg-slate-100 text-slate-700"];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
