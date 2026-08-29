"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Vai sempre buscar a visita aberta mais recente diretamente à BD — usado
// pelo botão "Terminar serviço" para nunca depender de um valor de
// visitaAbertaId que possa ter ficado desatualizado num render anterior
// (era exatamente isto que fazia o botão "Confirmar" não fazer nada: se o
// id da visita passado por prop estivesse desatualizado/nulo, submeter()
// saía em silêncio sem gravar nem avisar o técnico de nada).
export async function obterVisitaAberta(serviceId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("visits")
    .select("id")
    .eq("service_id", serviceId)
    .is("hora_fim_real", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function iniciarServico(serviceId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("tech_start_service", { p_service_id: serviceId });
  if (error) throw new Error(error.message);
  revalidatePath(`/tecnico/servico/${serviceId}`);
  return data as string; // id da visita criada
}

export async function concluirVisita(input: {
  visitId: string;
  serviceId: string;
  resultado: "concluido" | "nova_visita" | "nao_realizado";
  trabalhoRealizado: string;
  materiais: { nome: string; qtd: number; precoUnit?: number }[];
  fotos: string[];
  maoObraTipo?: string | null;
  maoObraDetalhe?: string | null;
  novaDataAgendada?: string | null;
  novaHoraAgendada?: string | null;
  problemaIdentificado?: string | null;
  equipamentoInstalado?: string | null;
  quantidadeInstalada?: number | null;
  testesRealizados?: string | null;
}) {
  const supabase = createClient();

  // Materiais chegam de um formulário do técnico como objeto tipado (não
  // FormData), mas continuam a ser input do cliente — qtd/precoUnit
  // negativos alimentariam diretamente visits.valor_calculado e, desde o
  // BLOCO 14, também services.valor. Mesma regra de sinal de criarServico.
  if (input.materiais.some((m) => !Number.isFinite(m.qtd) || m.qtd < 0 || (m.precoUnit != null && (!Number.isFinite(m.precoUnit) || m.precoUnit < 0)))) {
    throw new Error("Quantidade e preço unitário dos materiais têm de ser números iguais ou superiores a 0.");
  }

  const { error } = await supabase.rpc("tech_finish_visit", {
    p_visit_id: input.visitId,
    p_resultado: input.resultado,
    p_trabalho_realizado: input.trabalhoRealizado,
    p_materiais: input.materiais.map((m) => ({ nome: m.nome, qtd: m.qtd, preco_unit: m.precoUnit ?? 0 })),
    p_fotos: input.fotos,
    p_mao_obra_tipo: input.maoObraTipo ?? null,
    p_mao_obra_detalhe: input.maoObraDetalhe ?? null,
    p_nova_data_agendada: input.novaDataAgendada ?? null,
    p_nova_hora_agendada: input.novaHoraAgendada ?? null,
    p_problema_identificado: input.problemaIdentificado ?? null,
    p_equipamento_instalado: input.equipamentoInstalado ?? null,
    p_quantidade_instalada: input.quantidadeInstalada ?? null,
    p_testes_realizados: input.testesRealizados ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/tecnico/servico/${input.serviceId}`);
  revalidatePath("/tecnico");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/agenda");
}
