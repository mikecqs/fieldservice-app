import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { guardarConfiguracoes } from "./actions";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const organizationId = await getOrgId();
  const { data: settings } = await supabase
    .from("org_settings")
    .select("tipos_servico, followup_dias_default")
    .eq("organization_id", organizationId)
    .single();

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-0.5 text-sm text-slate-500">Definições específicas desta empresa.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <form action={guardarConfiguracoes} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Tipos de serviço (separados por vírgula)</span>
            <input
              name="tipos_servico"
              defaultValue={(settings?.tipos_servico ?? []).join(", ")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Usados nos formulários de novo pedido e novo serviço.
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Dias até follow-up de orçamento</span>
            <input
              name="followup_dias_default"
              type="number"
              defaultValue={settings?.followup_dias_default ?? 3}
              className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800">
            Guardar
          </button>
        </form>
      </div>
    </div>
  );
}
