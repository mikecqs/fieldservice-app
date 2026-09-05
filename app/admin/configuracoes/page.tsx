import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { guardarConfiguracoes } from "./actions";
import { sincronizarAgora, desligarGoogleSheets } from "./integracoes-actions";
import { LogotipoForm } from "./LogotipoForm";

export default async function ConfiguracoesPage(
  props: {
    searchParams: Promise<{ sheets?: string; sheets_erro?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const organizationId = await getOrgId();
  const { data: settings } = await supabase
    .from("org_settings")
    .select(
      "followup_dias_default, valor_mao_obra_primeira_hora, valor_mao_obra_hora_adicional, valor_mao_obra_dia_completo, valor_mao_obra_2_dias, valor_mao_obra_visita_orcamento, valor_mao_obra_taxa_deslocacao"
    )
    .eq("organization_id", organizationId)
    .single();
  const { data: sheets } = await supabase
    .from("google_sheets_integrations")
    .select("status, spreadsheet_url, google_email, last_synced_at, last_error")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const { data: org } = await supabase.from("organizations").select("logo_path").eq("id", organizationId).single();
  let logoUrl: string | null = null;
  if (org?.logo_path) {
    const { data: assinado } = await supabase.storage.from("logos").createSignedUrl(org.logo_path, 3600);
    logoUrl = assinado?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Configurações</h1>
        <p className="mt-0.5 text-sm text-neutral-400">Definições específicas desta empresa.</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <form action={guardarConfiguracoes} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-300">Dias até follow-up de orçamento</span>
            <input
              name="followup_dias_default"
              type="number"
              defaultValue={settings?.followup_dias_default ?? 3}
              className="w-32 rounded-md border border-neutral-700 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-300">Preços da mão de obra</span>
            <p className="mb-2 text-xs text-neutral-500">
              Usados automaticamente pelo Técnico ao fechar um serviço, consoante a duração escolhida (1h a 2 dias
              completos), e também na linha "Mão de Obra - Serviços Externos" dos Orçamentos (mesma tabela de
              preços, mesma duração à escolha). Nenhum dos dois introduz o preço manualmente.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-400">Visita para Orçamento (€)</span>
                <input
                  name="valor_mao_obra_visita_orcamento"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={settings?.valor_mao_obra_visita_orcamento ?? 0}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-400">Taxa de Deslocação (€)</span>
                <input
                  name="valor_mao_obra_taxa_deslocacao"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={settings?.valor_mao_obra_taxa_deslocacao ?? 20}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-400">1ª hora (€)</span>
                <input
                  name="valor_mao_obra_primeira_hora"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={settings?.valor_mao_obra_primeira_hora ?? 40}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-400">Hora adicional (€)</span>
                <input
                  name="valor_mao_obra_hora_adicional"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={settings?.valor_mao_obra_hora_adicional ?? 30}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-400">Dia completo (€)</span>
                <input
                  name="valor_mao_obra_dia_completo"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={settings?.valor_mao_obra_dia_completo ?? 250}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-400">2 dias completos (€)</span>
                <input
                  name="valor_mao_obra_2_dias"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={settings?.valor_mao_obra_2_dias ?? 500}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

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

      <LogotipoForm logoUrl={logoUrl} />

      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-1 text-sm font-semibold text-neutral-100">Integrações</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Espelho de gestão em tempo real da empresa num Google Sheet, para consulta da chefia.
        </p>

        {searchParams.sheets === "conectado" && (
          <p className="mb-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
            Google Sheets ligado com sucesso — o teu ficheiro já foi criado.
          </p>
        )}
        {searchParams.sheets_erro && (
          <p className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
            {searchParams.sheets_erro}
          </p>
        )}

        <div className="rounded-lg border border-neutral-800 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
            <span>🔗 Google Sheets</span>
          </div>

          {(!sheets || sheets.status === "desligado") && (
            <>
              <p className="mb-3 text-xs text-neutral-400">Desligado.</p>
              <a
                href="/api/integrations/google-sheets/connect"
                className="inline-block rounded-md bg-white px-3.5 py-2 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
              >
                Ligar Google Sheets
              </a>
            </>
          )}

          {sheets?.status === "erro" && (
            <>
              <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> A sincronização está temporariamente indisponível. Será tentada novamente automaticamente.
              </p>
              <a
                href="/api/integrations/google-sheets/connect"
                className="inline-block rounded-md bg-white px-3.5 py-2 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
              >
                Voltar a ligar
              </a>
            </>
          )}

          {sheets?.status === "ativo" && (
            <>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Google Sheets ligado
              </p>
              <p className="mb-0.5 text-xs text-neutral-400">Conta: {sheets.google_email ?? "—"}</p>
              <p className="mb-3 text-xs text-neutral-400">
                Última sincronização: {sheets.last_synced_at ? new Date(sheets.last_synced_at).toLocaleString("pt-PT") : "ainda sem alterações"}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={sheets.spreadsheet_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
                >
                  Abrir Google Sheets
                </a>
                <form action={sincronizarAgora}>
                  <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800">
                    Sincronizar agora
                  </button>
                </form>
                <details className="relative">
                  <summary className="list-none cursor-pointer rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10">
                    Desligar Google Sheets
                  </summary>
                  <div className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-lg">
                    <p className="text-xs text-neutral-300">
                      Tens a certeza? A sincronização para e a autorização é revogada. O Google Sheet e os dados já
                      lá gravados não são apagados.
                    </p>
                    <form action={desligarGoogleSheets}>
                      <button className="w-full rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
                        Confirmar
                      </button>
                    </form>
                  </div>
                </details>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
