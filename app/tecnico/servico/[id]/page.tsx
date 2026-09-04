import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { ServicoDetalheClient } from "./ServicoDetalheClient";

export default async function ServicoTecnicoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const organizationId = await getOrgId();

  const { data: servico } = await supabase
    .from("services_technician_view")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!servico) notFound();

  const [{ data: materiaisPrevistos }, { data: catalogo }, { data: settings }, { data: visitaAberta }, { data: visitaAnteriorRaw }] = await Promise.all([
    servico.detalhes_visiveis
      ? supabase.from("service_materials_planned").select("nome, qtd, preco_venda").eq("service_id", params.id)
      : Promise.resolve({ data: [] as { nome: string; qtd: number; preco_venda: number }[] }),
    supabase.from("catalog_items").select("id, referencia, descricao, preco_venda").order("referencia").limit(500),
    supabase
      .from("org_settings")
      .select(
        "valor_mao_obra_primeira_hora, valor_mao_obra_hora_adicional, valor_mao_obra_dia_completo, valor_mao_obra_2_dias, valor_mao_obra_visita_orcamento, valor_mao_obra_taxa_deslocacao"
      )
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
    // Fecho anterior (rejeitado) — só faz sentido ir buscar quando existe
    // motivo de correção; usado para mostrar tudo "congelado" ao técnico ao
    // reabrir (nada desaparece), nunca para pré-preencher o novo fecho.
    servico.motivo_correcao
      ? supabase
          .from("visits")
          .select(
            "trabalho_realizado, problema_identificado, equipamento_instalado, quantidade_instalada, testes_realizados, mao_obra_tipo, mao_obra_detalhe, visit_materials_used(nome, qtd, preco_unit), visit_photos(storage_path)"
          )
          .eq("service_id", params.id)
          .not("hora_fim_real", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  let fotosAnterioresUrls: string[] = [];
  if (visitaAnteriorRaw?.visit_photos?.length) {
    const paths = visitaAnteriorRaw.visit_photos.map((p: any) => p.storage_path);
    const { data: assinadas } = await supabase.storage.from("visitas").createSignedUrls(paths, 3600);
    fotosAnterioresUrls = (assinadas ?? []).map((s: any) => s.signedUrl).filter(Boolean);
  }

  const visitaAnterior = visitaAnteriorRaw
    ? {
        trabalhoRealizado: visitaAnteriorRaw.trabalho_realizado as string | null,
        problemaIdentificado: visitaAnteriorRaw.problema_identificado as string | null,
        equipamentoInstalado: visitaAnteriorRaw.equipamento_instalado as string | null,
        quantidadeInstalada: visitaAnteriorRaw.quantidade_instalada as number | null,
        testesRealizados: visitaAnteriorRaw.testes_realizados as string | null,
        maoObraTipo: visitaAnteriorRaw.mao_obra_tipo as string | null,
        maoObraDetalhe: visitaAnteriorRaw.mao_obra_detalhe as string | null,
        materiais: (visitaAnteriorRaw.visit_materials_used ?? []) as { nome: string; qtd: number; preco_unit: number }[],
        fotosUrls: fotosAnterioresUrls,
      }
    : null;

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
        visitaOrcamento: settings?.valor_mao_obra_visita_orcamento ?? 0,
        taxaDeslocacao: settings?.valor_mao_obra_taxa_deslocacao ?? 0,
      }}
      visitaAbertaId={visitaAberta?.id ?? null}
      organizationId={organizationId}
      visitaAnterior={visitaAnterior}
    />
  );
}
