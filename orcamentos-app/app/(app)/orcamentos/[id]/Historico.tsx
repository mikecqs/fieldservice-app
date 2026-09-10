type EventoOrcamento = {
  id: string;
  tipo: string;
  descricao: string;
  created_at: string;
};

export default function Historico({ eventos }: { eventos: EventoOrcamento[] }) {
  if (eventos.length === 0) return null;

  return (
    <section className="rounded-2xl border border-edge bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Histórico</h2>
      <ol className="space-y-3">
        {eventos.map((evento) => (
          <li key={evento.id} className="flex items-start gap-3 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <div>
              <p className="text-neutral-200">{evento.descricao}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(evento.created_at).toLocaleString("pt-PT")}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
