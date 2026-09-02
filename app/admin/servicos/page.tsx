import { createClient } from "@/lib/supabase/server";
import { calcularPreparacao } from "@/lib/preparacao";
import { ServicosLista } from "./ServicosLista";

export default async function ServicosPage() {
  const supabase = createClient();
  const { data: servicos } = await supabase
    .from("services")
    .select(
      "id, tipo, descricao, prioridade, estado, data_agendada, hora_agendada, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id)"
    )
    .order("created_at", { ascending: false });

  // Compras ocultado por decisão de produto (temporário) — sinal de
  // "material bloqueando" desligado, os restantes critérios de preparação
  // continuam ativos.
  const servicosComPreparacao = (servicos ?? []).map((s: any) => {
    const prep = calcularPreparacao({
      temTecnico: (s.service_technicians ?? []).length > 0,
      morada: s.client_addresses?.endereco,
      temContacto: !!(s.clients?.telefone || s.clients?.email),
      descricao: s.descricao,
      dataAgendada: s.data_agendada,
      horaAgendada: s.hora_agendada,
      materialBloqueando: false,
    });
    return { ...s, preparacaoNivel: prep.nivel, preparacaoMotivos: prep.motivos };
  });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Serviços</h1>
          <p className="mt-0.5 text-sm text-neutral-400">Ordens de serviço, desde agendamento até conclusão.</p>
        </div>
        {/* Auditoria "Centralizar criação" — o botão "Novo serviço" já não
            existe aqui (já não fazia nada além de apontar para Pedidos, ver
            Onda 3/Etapa 9). A criação de trabalho novo está agora centralizada
            só em /admin/pedidos, que continua a cobrir exatamente o mesmo
            caso (tipo "Agendamento" cria o serviço de imediato). */}
      </div>

      <ServicosLista servicos={servicosComPreparacao} />
    </div>
  );
}
