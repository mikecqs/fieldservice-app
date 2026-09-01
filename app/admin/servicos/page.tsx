import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularPreparacao } from "@/lib/preparacao";
import { ServicosLista } from "./ServicosLista";

export default async function ServicosPage() {
  const supabase = createClient();
  const [{ data: servicos }, { data: comprasPendentes }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, tipo, descricao, prioridade, estado, data_agendada, hora_agendada, clients(nome, telefone, email), client_addresses(endereco), service_technicians(user_id)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("purchases").select("service_id").in("estado", ["por_encomendar", "encomendada", "parcial"]),
  ]);

  const materialPendentePorServico = new Set((comprasPendentes ?? []).map((c: any) => c.service_id));

  const servicosComPreparacao = (servicos ?? []).map((s: any) => {
    const prep = calcularPreparacao({
      temTecnico: (s.service_technicians ?? []).length > 0,
      morada: s.client_addresses?.endereco,
      temContacto: !!(s.clients?.telefone || s.clients?.email),
      descricao: s.descricao,
      dataAgendada: s.data_agendada,
      horaAgendada: s.hora_agendada,
      materialBloqueando: materialPendentePorServico.has(s.id),
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
        {/* Onda 3 (Etapa 9) — /admin/servicos/novo deixou de existir como
            ponto de criação independente (decisão C da auditoria): criar um
            serviço passa sempre pelo fluxo de Pedido, que já cobre o mesmo
            caso (tipo "Agendamento" cria o serviço de imediato) e acrescenta
            rastreabilidade (Origem) que este caminho nunca tinha. */}
        <Link
          href="/admin/pedidos/novo"
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Novo serviço
        </Link>
      </div>

      <ServicosLista servicos={servicosComPreparacao} />
    </div>
  );
}
