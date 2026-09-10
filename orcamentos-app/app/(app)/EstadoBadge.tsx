import { ROTULOS_ESTADO, type EstadoOrcamento } from "@/lib/orcamento-estado";

// Mesma convenção de cor de estado já usada no resto do ecossistema
// Tareo/Serv (ver comentário em tailwind.config.ts na raiz do repo):
// âmbar = atenção/pendente, esmeralda = sucesso, vermelho = perigo/
// rejeitado, azul (sky) = informativo/em curso.
const CORES: Record<EstadoOrcamento, string> = {
  rascunho: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20",
  enviado: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  followup: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  aceite: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  servico_realizado: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  faturado: "bg-emerald-600/10 text-emerald-300 border-emerald-600/30",
  recusado: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelado: "bg-neutral-500/10 text-muted-foreground border-edge",
};

export default function EstadoBadge({ estado }: { estado: string }) {
  const cor = CORES[estado as EstadoOrcamento] ?? "bg-neutral-500/10 text-neutral-300 border-edge";
  const rotulo = ROTULOS_ESTADO[estado as EstadoOrcamento] ?? estado;

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cor}`}>
      {rotulo}
    </span>
  );
}
