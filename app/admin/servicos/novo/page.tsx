import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { criarServico } from "../actions";

export default async function NovoServicoPage() {
  const supabase = createClient();
  const organizationId = await getOrgId();

  const [{ data: clients }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("id, nome, client_addresses(id, label, endereco)").order("nome"),
    supabase.from("org_settings").select("tipos_servico").eq("organization_id", organizationId).single(),
  ]);

  const tipos = settings?.tipos_servico ?? ["Manutenção", "Instalação", "Orçamento"];

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/servicos" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Serviços
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold text-slate-900">Novo serviço</h1>
        {(clients ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">
            Precisas de ter pelo menos um cliente criado. <Link href="/admin/clientes/novo" className="text-indigo-700 underline">Criar cliente</Link>.
          </p>
        ) : (
          <form action={criarServico} className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Cliente</span>
              <select name="client_id" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Morada (opcional)</span>
              <select name="address_id" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">—</option>
                {(clients ?? []).flatMap((c: any) =>
                  (c.client_addresses ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{c.nome} — {a.label}: {a.endereco}</option>
                  ))
                )}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Tipo</span>
              <select name="tipo" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {tipos.map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Prioridade</span>
              <select name="prioridade" defaultValue="normal" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Descrição</span>
              <textarea name="descricao" required rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Valor (€)</span>
              <input name="valor" type="number" step="0.01" defaultValue="0" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <div className="col-span-2 mt-2 flex justify-end gap-2">
              <Link href="/admin/servicos" className="rounded-md border border-slate-300 px-3.5 py-2 text-sm text-slate-700">
                Cancelar
              </Link>
              <button type="submit" className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800">
                Criar serviço
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
