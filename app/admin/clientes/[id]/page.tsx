import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarEquipamento, removerEquipamento } from "./actions";

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: cliente } = await supabase
    .from("clients")
    .select("*, client_addresses(*)")
    .eq("id", params.id)
    .single();

  if (!cliente) notFound();

  const [{ data: requests }, { data: services }, { data: budgets }, { data: equipamentos }] = await Promise.all([
    supabase.from("requests").select("id, descricao, estado, created_at").eq("client_id", params.id),
    supabase.from("services").select("id, descricao, tipo, estado, data_agendada, faturacao_estado, faturacao_valor, equipment_id").eq("client_id", params.id),
    supabase.from("budgets").select("id, estado").eq("client_id", params.id),
    supabase
      .from("client_equipment")
      .select("*, client_addresses(label, endereco)")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  const faturado = (services ?? [])
    .filter((s) => s.faturacao_estado === "faturado")
    .reduce((a, s) => a + (s.faturacao_valor ?? 0), 0);

  const intervencoesPorEquipamento = new Map<string, any[]>();
  for (const s of services ?? []) {
    if (!s.equipment_id) continue;
    const lista = intervencoesPorEquipamento.get(s.equipment_id) ?? [];
    lista.push(s);
    intervencoesPorEquipamento.set(s.equipment_id, lista);
  }

  const fotosUrls = new Map<string, string>();
  for (const e of equipamentos ?? []) {
    if (e.foto_path) {
      const { data } = await supabase.storage.from("equipamentos").createSignedUrl(e.foto_path, 3600);
      if (data?.signedUrl) fotosUrls.set(e.id, data.signedUrl);
    }
  }

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

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Equipamentos · {(equipamentos ?? []).length}</h2>
        <div className="mb-4 space-y-3">
          {(equipamentos ?? []).map((e: any) => {
            const intervencoes = intervencoesPorEquipamento.get(e.id) ?? [];
            return (
              <div key={e.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-start gap-3">
                  {fotosUrls.has(e.id) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotosUrls.get(e.id)} alt={e.equipamento} className="h-16 w-16 shrink-0 rounded-md object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{e.equipamento}</span>
                      {e.marca && <span className="text-xs text-slate-500">{e.marca} {e.modelo}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {e.numero_serie && <span>Nº série: {e.numero_serie} · </span>}
                      {e.data_instalacao && <span>Instalado em {e.data_instalacao} · </span>}
                      {e.client_addresses?.label && <span>{e.client_addresses.label}</span>}
                    </div>
                    {e.notas && <p className="mt-1 text-xs text-slate-500">{e.notas}</p>}
                  </div>
                  <form action={removerEquipamento}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="client_id" value={params.id} />
                    <button className="text-xs text-red-600 hover:underline">remover</button>
                  </form>
                </div>
                {intervencoes.length > 0 && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
                      Histórico de intervenções · {intervencoes.length}
                    </div>
                    <div className="space-y-1">
                      {intervencoes.map((s: any) => (
                        <Link
                          key={s.id}
                          href={`/admin/servicos/${s.id}`}
                          className="block rounded bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          {s.tipo} · {s.descricao} {s.data_agendada ? `· ${s.data_agendada}` : ""}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {(equipamentos ?? []).length === 0 && (
            <p className="text-sm text-slate-400">Ainda sem equipamentos registados.</p>
          )}
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-medium text-indigo-700">+ Registar equipamento</summary>
          <form action={criarEquipamento} encType="multipart/form-data" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input type="hidden" name="client_id" value={params.id} />
            <input name="equipamento" placeholder="Equipamento (ex: Câmara IP, Central de alarme)" required className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            {(cliente.client_addresses ?? []).length > 0 && (
              <select name="address_id" className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Localização — sem especificar</option>
                {(cliente.client_addresses ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.label}: {a.endereco}</option>
                ))}
              </select>
            )}
            <input name="marca" placeholder="Marca" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="modelo" placeholder="Modelo" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="numero_serie" placeholder="Número de série / referência" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Data de instalação</span>
              <input name="data_instalacao" type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <textarea name="notas" placeholder="Notas (opcional)" rows={2} className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Fotografia (opcional)</span>
              <input name="foto" type="file" accept="image/*" className="w-full text-sm" />
            </label>
            <button className="col-span-2 mt-1 rounded-md bg-indigo-900 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800">
              Registar equipamento
            </button>
          </form>
        </details>
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
