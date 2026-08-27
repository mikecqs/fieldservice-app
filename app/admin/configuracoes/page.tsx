import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { guardarConfiguracoes } from "./actions";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const organizationId = await getOrgId();
  const { data: settings } = await supabase
    .from("org_settings")
    .select("tipos_servico, followup_dias_default, acesso_sequencial_tecnico")
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
          <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              name="acesso_sequencial_tecnico"
              defaultChecked={settings?.acesso_sequencial_tecnico ?? false}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">Acesso sequencial aos serviços</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Quando ativo, um técnico só vê a morada, contacto, descrição e notas do serviço seguinte depois
                de encerrar o anterior (concluído, nova visita, não realizado ou cancelado). Continua a ver a
                hora e o cliente de todos os serviços do dia. Controlo operacional, não afeta o Admin.
              </span>
            </span>
          </label>
          <button className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800">
            Guardar
          </button>
        </form>
      </div>
    </div>
  );
}
