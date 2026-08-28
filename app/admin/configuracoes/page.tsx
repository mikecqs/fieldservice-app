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
        <h1 className="text-xl font-bold text-white">Configurações</h1>
        <p className="mt-0.5 text-sm text-neutral-400">Definições específicas desta empresa.</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <form action={guardarConfiguracoes} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-300">Tipos de serviço (separados por vírgula)</span>
            <input
              name="tipos_servico"
              defaultValue={(settings?.tipos_servico ?? []).join(", ")}
              className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Usados nos formulários de novo pedido e novo serviço.
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-300">Dias até follow-up de orçamento</span>
            <input
              name="followup_dias_default"
              type="number"
              defaultValue={settings?.followup_dias_default ?? 3}
              className="w-32 rounded-md border border-neutral-700 px-3 py-2 text-sm"
            />
          </label>
          <p className="rounded-md border border-neutral-800 bg-neutral-800 p-3 text-xs text-neutral-400">
            O técnico vê sempre a morada, contacto e descrição do serviço atual e do seguinte (para poder avisar
            o próximo cliente se estiver atrasado) — a partir do 2º seguinte, só vê a hora e o cliente. Isto é
            automático e não precisa de configuração.
          </p>
          <button className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
            Guardar
          </button>
        </form>
      </div>
    </div>
  );
}
