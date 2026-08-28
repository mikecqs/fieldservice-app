import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decidirComOrcamento, decidirSemOrcamento } from "../../actions";

export default async function DecisaoPedidoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pedido } = await supabase
    .from("requests")
    .select("id, tipo, descricao, client_id, clients(nome)")
    .eq("id", params.id)
    .single();

  if (!pedido) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/pedidos" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Pedidos
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{pedido.tipo}</span>
          <h1 className="mt-2 text-lg font-bold text-slate-900">{(pedido as any).clients?.nome}</h1>
          <p className="mt-1 text-sm text-slate-600">{pedido.descricao}</p>
        </div>

        <p className="mb-4 text-sm font-medium text-slate-700">É necessário orçamento?</p>

        <div className="flex gap-3">
          <form action={decidirComOrcamento} className="flex-1">
            <input type="hidden" name="id" value={pedido.id} />
            <input type="hidden" name="client_id" value={pedido.client_id} />
            <button className="w-full rounded-md bg-indigo-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800">
              Sim → Orçamento
            </button>
          </form>
          <form action={decidirSemOrcamento} className="flex-1">
            <input type="hidden" name="id" value={pedido.id} />
            <button className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Não → Agendamento
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
