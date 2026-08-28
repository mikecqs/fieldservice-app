import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServicoDetalheClient } from "./ServicoDetalheClient";

export default async function ServicoTecnicoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: servico } = await supabase
    .from("services_technician_view")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!servico) notFound();

  // Enquanto bloqueado, nem os materiais previstos (que descrevem o
  // trabalho) são pedidos — o servidor nunca chega a ler essa informação.
  const { data: materiaisPrevistos } = servico.detalhes_visiveis
    ? await supabase.from("service_materials_planned").select("nome, qtd").eq("service_id", params.id)
    : { data: [] };

  const { data: visitaAberta } = await supabase
    .from("visits")
    .select("id")
    .eq("service_id", params.id)
    .is("hora_fim_real", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <ServicoDetalheClient
      servico={servico as any}
      materiaisPrevistos={materiaisPrevistos ?? []}
      visitaAbertaId={visitaAberta?.id ?? null}
    />
  );
}
