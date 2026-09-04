import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avancarEstadoCompra } from "./actions";
import { rotuloTipoServico } from "@/lib/servico-estado";

const ESTADO_LABEL: Record<string, string> = {
  por_encomendar: "Por encomendar",
  encomendada: "Encomendada",
  parcial: "Recebida parcialmente",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

const PROXIMO_ESTADO: Record<string, string> = {
  por_encomendar: "encomendada",
  encomendada: "recebida",
  parcial: "recebida",
};

export default async function ComprasPage() {
  // Ocultado por decisão de produto (temporário, pedido explícito) — rota,
  // ações e schema continuam intactos; só o acesso está desligado. Reverter
  // basta remover este redirect.
  redirect("/admin/servicos");

  const supabase = await createClient();
  const { data: compras } = await supabase
    .from("purchases")
    .select("id, descricao, fornecedor, estado, data_prevista, service_id, purchase_items(nome, qtd), services(id, tipo, descricao, clients(nome))")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Compras</h1>
          <p className="mt-0.5 text-sm text-neutral-400">Material a encomendar para os serviços.</p>
        </div>
        <Link
          href="/admin/compras/novo"
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Nova compra
        </Link>
      </div>

      <div className="space-y-3">
        {(compras ?? []).map((c: any) => (
          <div key={c.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="font-medium text-neutral-100">{c.descricao}</div>
                {c.services ? (
                  <Link
                    href={`/admin/servicos/${c.services.id}`}
                    className="mt-0.5 inline-block text-xs text-neutral-200 underline"
                  >
                    {c.services.clients?.nome} — {rotuloTipoServico(c.services.tipo)} · {c.services.descricao}
                  </Link>
                ) : (
                  <div className="mt-0.5 text-xs text-neutral-500">Sem serviço associado</div>
                )}
                {c.fornecedor && <div className="mt-0.5 text-xs text-neutral-500">Fornecedor: {c.fornecedor}</div>}
                {c.data_prevista && <div className="text-xs text-neutral-500">Previsto: {c.data_prevista}</div>}
              </div>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-200">
                {ESTADO_LABEL[c.estado] ?? c.estado}
              </span>
            </div>
            {(c.purchase_items ?? []).length > 0 && (
              <ul className="mb-2 list-disc pl-5 text-sm text-neutral-300">
                {c.purchase_items.map((i: any, idx: number) => (
                  <li key={idx}>{i.nome} · {i.qtd}</li>
                ))}
              </ul>
            )}
            {PROXIMO_ESTADO[c.estado] && (
              <form action={avancarEstadoCompra} className="flex gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="estado" value={PROXIMO_ESTADO[c.estado]} />
                <button className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
                  Marcar {ESTADO_LABEL[PROXIMO_ESTADO[c.estado]]}
                </button>
              </form>
            )}
          </div>
        ))}
        {(compras ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">Ainda sem compras.</p>
        )}
      </div>
    </div>
  );
}
