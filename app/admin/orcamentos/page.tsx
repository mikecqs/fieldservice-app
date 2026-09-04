import { createClient } from "@/lib/supabase/server";
import { calcularOrcamento } from "@/lib/orcamento";
import { OrcamentosLista } from "./OrcamentosLista";

export default async function OrcamentosPage() {
  const supabase = await createClient();
  const { data: orcamentos } = await supabase
    .from("budgets")
    .select("id, numero, estado, criado_em, enviado_em, iva_percent, clients(nome), budget_items(qtd, valor_unit)")
    .order("created_at", { ascending: false });

  const orcamentosComTotal = (orcamentos ?? []).map((o: any) => {
    const { total } = calcularOrcamento(o.budget_items ?? [], o.iva_percent);
    return { ...o, total };
  });

  return (
    <div>
      {/* Auditoria "Centralizar criação" — "Novo orçamento" removido daqui de
          propósito: a única forma de criar um Orçamento sem passar por um
          Pedido. A entrada principal para trabalho novo é sempre
          /admin/pedidos (tipo "Orçamento", ou "sim" a "precisa de
          orçamento?"). A rota /admin/orcamentos/novo e a Server Action
          criarOrcamento continuam a existir (não eliminadas), só deixaram de
          ter link nenhum — mesma decisão já tomada para /admin/servicos/novo.
          duplicarOrcamento (na ficha de um orçamento existente) não é afetado
          — é uma ação diferente, continua a fazer sentido. */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Orçamentos</h1>
        <p className="mt-0.5 text-sm text-neutral-400">Do rascunho até à aceitação (que gera o serviço).</p>
      </div>

      <OrcamentosLista orcamentos={orcamentosComTotal} />
    </div>
  );
}
