import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: cliente } = await supabase
    .from("clients")
    .select("*, client_addresses(*)")
    .eq("id", params.id)
    .single();

  if (!cliente) notFound();

  const [{ data: requests }, { data: services }, { data: budgets }] = await Promise.all([
    supabase.from("requests").select("id, descricao, estado, created_at").eq("client_id", params.id),
    supabase.from("services").select("id, descricao, estado, faturacao_estado, faturacao_valor").eq("client_id", params.id),
    supabase.from("budgets").select("id, estado").eq("client_id", params.id),
  ]);

  const faturado = (services ?? [])
    .filter((s) => s.faturacao_estado === "faturado")
    .reduce((a, s) => a + (s.faturacao_valor ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/clientes" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Clientes
      </Link>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{cliente.nome}</h1>
            {cliente.empresa && <p className="text-sm text-slate-500">{cliente.empresa}</p>}
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            NIF {cliente.nif || "—"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1 text-sm text-slate-600 sm:grid-cols-2 sm:gap-4">
          <div>{cliente.telefone}</div>
          <div>{cliente.email}</div>
        </div>
        <div className="mt-3 space-y-1.5">
          {(cliente.client_addresses ?? []).map((m: any) => (
            <div key={m.id} className="text-sm text-slate-600">
              <span className="font-medium">{m.label}:</span> {m.endereco}
            </div>
          ))}
        </div>
        {cliente.notas && <p className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500">{cliente.notas}</p>}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatBox label="Serviços" value={services?.length ?? 0} />
        <StatBox label="Orçamentos" value={budgets?.length ?? 0} />
        <StatBox
          label="Faturado (histórico)"
          value={faturado.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
        />
      </div>

      <Bloco titulo="Pedidos" itens={requests} render={(r: any) => r.descricao} />
      <Bloco titulo="Serviços" itens={services} render={(s: any) => s.descricao} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 text-xs font-medium text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Bloco({ titulo, itens, render }: { titulo: string; itens: any[] | null; render: (x: any) => string }) {
  if (!itens || itens.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {titulo} · {itens.length}
      </h3>
      <div className="space-y-1.5">
        {itens.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-100 bg-white p-3 text-sm text-slate-700">
            {render(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
