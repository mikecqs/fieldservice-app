import { createClient } from "@/lib/supabase/server";
import { podeReagendarServico, deveTransicionarParaAgendado } from "@/lib/servico-estado";

// Onda 3 (Etapa 5) — única escrita da operação de agendamento em `services`,
// partilhada por `atualizarAgendamento` (app/admin/servicos/actions.ts,
// ficha do Serviço) e `criarOuAgendarNoPopup` (app/admin/agenda/actions.ts,
// ramo de agendar um serviço já existente a partir do popup da Agenda).
//
// Fica num módulo próprio (não dentro de nenhum dos dois ficheiros "use
// server"), pelo mesmo motivo de lib/service-events.ts/lib/budget-events.ts:
// uma função exportada de um ficheiro "use server" torna-se uma referência
// de Server Action, o que exige argumentos serializáveis — este helper
// recebe o próprio cliente Supabase como argumento, por isso não pode viver
// lá nem ser chamado a partir de um componente cliente diretamente.
//
// Deliberadamente estreito: só faz a leitura do estado atual, a validação
// de podeReagendarServico, a decisão de transição para "agendado" (via
// deveTransicionarParaAgendado) e o próprio update. Tudo o resto —
// revalidatePath, redirects, mensagens de evento, prioridade/notas (só
// atualizarAgendamento as tem), criação do serviço, atribuição de técnico,
// requestId, e a validação de presença dos campos (os dois fluxos têm
// regras diferentes: atualizarAgendamento aceita "tudo vazio" para tirar o
// agendamento; criarOuAgendarNoPopup exige sempre os três preenchidos) —
// continua em cada chamador, porque são legitimamente diferentes entre os
// dois fluxos.
export async function escreverAgendamentoServico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    serviceId: string;
    dataAgendada: string | null;
    horaAgendada: string | null;
    horaFimAgendada: string | null;
    // Campos adicionais a gravar na mesma escrita — só atualizarAgendamento
    // usa isto (prioridade/notas); criarOuAgendarNoPopup nunca os toca.
    camposExtra?: Record<string, unknown>;
  }
) {
  const { data: current } = await supabase
    .from("services")
    .select("estado, data_agendada, faturacao_estado")
    .eq("id", input.serviceId)
    .single();
  if (!current) return null;

  if (!podeReagendarServico(current)) {
    throw new Error("Este serviço já não pode ser reagendado (concluído, cancelado, não realizado ou já faturado).");
  }

  const update: Record<string, unknown> = {
    data_agendada: input.dataAgendada,
    hora_agendada: input.horaAgendada,
    hora_fim_agendada: input.horaFimAgendada,
    ...input.camposExtra,
  };
  if (input.dataAgendada && deveTransicionarParaAgendado(current.estado)) {
    update.estado = "agendado";
  }

  await supabase.from("services").update(update).eq("id", input.serviceId);

  // Devolve o estado ANTES da escrita — é o que cada chamador precisa para
  // compor a sua própria mensagem de evento (ex: "Agendado" vs
  // "Reagendado", consoante já havia ou não data_agendada antes).
  return current;
}
