import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { ServicoDetalheClient } from "./ServicoDetalheClient";

export default async function ServicoTecnicoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const organizationId = await getOrgId();

  const { data: servico } = await supabase
    .from("services_technician_view")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!servico) notFound();

  const [{ data: materiaisPrevistos }, { data: catalogo }, { data: settings }, { data: visitaAberta }] = await Promise.all([
    servico.detalhes_visiveis
      ? supabase.from("service_materials_planned").select("nome, qtd, preco_venda").eq("service_id", params.id)
      : Promise.resolve({ data: [] as { nome: string; qtd: number; preco_venda: number }[] }),
    supabase.from("catalog_items").select("id, referencia, descricao, preco_venda").order("referencia").limit(500),
    supabase
      .from("org_settings")
      .select("valor_mao_obra_primeira_hora, valor_mao_obra_hora_adicional, valor_mao_obra_dia_completo, valor_mao_obra_2_dias")
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("visits")
      .select("id")
      .eq("service_id", params.id)
      .is("hora_fim_real", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <ServicoDetalheClient
      servico={servico as any}
      materiaisPrevistos={materiaisPrevistos ?? []}
      catalogo={catalogo ?? []}
      precosMaoObra={{
        primeiraHora: settings?.valor_mao_obra_primeira_hora ?? 0,
        horaAdicional: settings?.valor_mao_obra_hora_adicional ?? 0,
        diaCompleto: settings?.valor_mao_obra_dia_completo ?? 0,
        doisDias: settings?.valor_mao_obra_2_dias ?? 0,
      }}
      visitaAbertaId={visitaAberta?.id ?? null}
      organizationId={organizationId}
    />
  );
}
