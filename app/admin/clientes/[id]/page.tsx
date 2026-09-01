import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { removerEquipamento } from "./actions";
import { ServicosPopup } from "./ServicosPopup";
import { PedidosCompactos } from "./PedidosCompactos";
import { RegistarEquipamentoForm } from "./RegistarEquipamentoForm";
import { rotuloTipoServico } from "@/lib/servico-estado";

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: cliente } = await supabase
    .from("clients")
    .select("*, client_addresses(*)")
    .eq("id", params.id)
    .single();

  if (!cliente) notFound();

  const [{ data: requests }, { data: services }, { data: budgets }, { data: equipamentos }] = await Promise.all([
    supabase.from("requests").select("id, codigo, tipo, descricao, estado, created_at").eq("client_id", params.id).order("created_at", { ascending: false }),
    supabase.from("services").select("id, codigo, descricao, tipo, estado, data_agendada, faturacao_estado, faturacao_valor, equipment_id").eq("client_id", params.id),
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
      <Link href="/admin/clientes" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Clientes
      </Link>

      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
              {cliente.codigo}
            </span>
            <h1 className="mt-1 text-lg font-bold text-white">{cliente.nome}</h1>
            {cliente.empresa && <p className="text-sm text-neutral-400">{cliente.empresa}</p>}
          </div>
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-200">
            NIF {cliente.nif || "—"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1 text-sm text-neutral-300 sm:grid-cols-2 sm:gap-4">
          <div>{cliente.telefone}</div>
          <div>{cliente.email}</div>
        </div>
        <div className="mt-3 space-y-1.5">
          {(cliente.client_addresses ?? []).map((m: any) => (
            <div key={m.id} className="text-sm text-neutral-300">
              <span className="font-medium">{m.label}:</span> {m.endereco}
            </div>
          ))}
        </div>
        {cliente.notas && <p className="mt-3 rounded-md bg-neutral-800 p-3 text-xs text-neutral-400">{cliente.notas}</p>}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <ServicosPopup servicos={(services ?? []) as any} />
        <StatBox label="Orçamentos" value={budgets?.length ?? 0} />
        <StatBox
          label="Faturado (histórico)"
          value={faturado.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
        />
      </div>

      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Equipamentos · {(equipamentos ?? []).length}</h2>
        <div className="mb-4 space-y-3">
          {(equipamentos ?? []).map((e: any) => {
            const intervencoes = intervencoesPorEquipamento.get(e.id) ?? [];
            return (
              <div key={e.id} className="rounded-lg border border-neutral-800 p-3">
                <div className="flex items-start gap-3">
                  {fotosUrls.has(e.id) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotosUrls.get(e.id)} alt={e.equipamento} className="h-16 w-16 shrink-0 rounded-md object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-100">{e.equipamento}</span>
                      {e.marca && <span className="text-xs text-neutral-400">{e.marca} {e.modelo}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {e.numero_serie && <span>Nº série: {e.numero_serie} · </span>}
                      {e.data_instalacao && <span>Instalado em {e.data_instalacao} · </span>}
                      {e.client_addresses?.label && <span>{e.client_addresses.label}</span>}
                    </div>
                    {e.notas && <p className="mt-1 text-xs text-neutral-400">{e.notas}</p>}
                  </div>
                  <form action={removerEquipamento}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="client_id" value={params.id} />
                    <button className="text-xs text-red-400 hover:underline">remover</button>
                  </form>
                </div>
                {intervencoes.length > 0 && (
                  <div className="mt-2 border-t border-neutral-800 pt-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-neutral-500">
                      Histórico de intervenções · {intervencoes.length}
                    </div>
                    <div className="space-y-1">
                      {intervencoes.map((s: any) => (
                        <Link
                          key={s.id}
                          href={`/admin/servicos/${s.id}`}
                          className="block rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                        >
                          {rotuloTipoServico(s.tipo)} · {s.descricao} {s.data_agendada ? `· ${s.data_agendada}` : ""}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {(equipamentos ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Ainda sem equipamentos registados.</p>
          )}
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-medium text-neutral-200">+ Registar equipamento</summary>
          <RegistarEquipamentoForm clientId={params.id} moradas={(cliente.client_addresses ?? []) as any} />
        </details>
      </div>

      <PedidosCompactos pedidos={(requests ?? []) as any} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 text-xs font-medium text-neutral-400">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
