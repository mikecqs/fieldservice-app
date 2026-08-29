import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { criarPedido } from "../actions";

export default async function NovoPedidoPage() {
  const supabase = createClient();
  const organizationId = await getOrgId();

  const [{ data: clients }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("id, nome").order("nome"),
    supabase.from("org_settings").select("tipos_servico").eq("organization_id", organizationId).single(),
  ]);

  const tipos = settings?.tipos_servico ?? ["Agendamento", "Orçamento", "Manutenção", "Instalação"];

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/pedidos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Pedidos
      </Link>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="mb-4 text-lg font-bold text-white">Novo pedido</h1>
        {(clients ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">
            Precisas de ter pelo menos um cliente criado. <Link href="/admin/clientes/novo" className="text-neutral-200 underline">Criar cliente</Link>.
          </p>
        ) : (
          <form action={criarPedido} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Cliente</span>
              <select name="client_id" required className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Tipo</span>
              <select name="tipo" required className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
                {tipos.map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Origem (opcional)</span>
              <input name="origem" placeholder="Telefone, email…" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Descrição</span>
              <textarea name="descricao" required rows={3} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" name="info_falta" className="rounded border-neutral-700" />
              Falta informação do cliente para avançar
            </label>
            <div className="col-span-2 mt-2 flex justify-end gap-2">
              <Link href="/admin/pedidos" className="rounded-md border border-neutral-700 px-3.5 py-2 text-sm text-neutral-200">
                Cancelar
              </Link>
              <button type="submit" className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
                Guardar pedido
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
