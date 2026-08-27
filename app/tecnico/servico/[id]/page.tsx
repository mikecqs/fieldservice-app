import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServicoDetalheClient } from "./ServicoDetalheClient";

export default async function ServicoTecnicoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: servico } = await supabase
    .from("services_technician_view")
    .select("*, clients_technician_view!inner(nome, telefone), client_addresses_technician_view(endereco)")
    .eq("id", params.id)
    .single();

  if (!servico) notFound();

  const { data: materiaisPrevistos } = await supabase
    .from("service_materials_planned")
    .select("nome, qtd")
    .eq("service_id", params.id);

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
