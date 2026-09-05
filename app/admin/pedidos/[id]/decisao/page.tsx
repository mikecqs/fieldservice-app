import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decidirComOrcamento, decidirSemOrcamento } from "../../actions";

export default async function DecisaoPedidoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: pedido } = await supabase
    .from("requests")
    .select("id, tipo, descricao, client_id, clients(nome)")
    .eq("id", params.id)
    .single();

  if (!pedido) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/pedidos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Pedidos
      </Link>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-4">
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">{pedido.tipo}</span>
          <h1 className="mt-2 text-lg font-bold text-white">{(pedido as any).clients?.nome}</h1>
          <p className="mt-1 text-sm text-neutral-300">{pedido.descricao}</p>
        </div>

        <p className="mb-4 text-sm font-medium text-neutral-200">É necessário orçamento?</p>

        <div className="flex gap-3">
          <form action={decidirComOrcamento} className="flex-1">
            <input type="hidden" name="id" value={pedido.id} />
            <button className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
              Sim → Orçamento
            </button>
          </form>
          <form action={decidirSemOrcamento} className="flex-1">
            <input type="hidden" name="id" value={pedido.id} />
            <button className="w-full rounded-md border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800">
              Não → Agendamento
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
