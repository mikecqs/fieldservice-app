import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import FollowUpLista, { type FollowUpLinha } from "./FollowUpLista";

export default async function FollowUpPage() {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: orcamentos } = await supabase
    .from("budgets")
    .select(
      "id, numero, estado, criado_em, followup_em, iva_percent, clients(nome, empresa, telefone), budget_items(quantidade, valor_unitario)"
    )
    .eq("company_id", empresa.id)
    .in("estado", ["enviado", "followup"])
    .order("followup_em", { ascending: true, nullsFirst: false });

  const linhas: FollowUpLinha[] = (orcamentos ?? []).map((orcamento) => {
    const cliente = orcamento.clients as unknown as {
      nome: string;
      empresa: string | null;
      telefone: string | null;
    };
    const items = (orcamento.budget_items ?? []) as { quantidade: number; valor_unitario: number }[];
    const { total } = calcularOrcamento(items, orcamento.iva_percent);

    return {
      id: orcamento.id,
      numero: orcamento.numero,
      estado: orcamento.estado,
      criadoEm: orcamento.criado_em,
      followupEm: orcamento.followup_em,
      total,
      clienteNome: cliente?.nome ?? "",
      clienteEmpresa: cliente?.empresa ?? "",
      clienteTelefone: cliente?.telefone ?? "",
    };
  });

  // Atrasados primeiro, depois por data de follow-up mais próxima, depois
  // os "enviado" ainda sem follow-up marcado (ordenados pelos mais antigos).
  const hoje = new Date().toISOString().slice(0, 10);
  linhas.sort((a, b) => {
    const aAtrasado = !!a.followupEm && a.followupEm < hoje;
    const bAtrasado = !!b.followupEm && b.followupEm < hoje;
    if (aAtrasado !== bAtrasado) return aAtrasado ? -1 : 1;
    if (a.followupEm && b.followupEm) return a.followupEm.localeCompare(b.followupEm);
    if (a.followupEm) return -1;
    if (b.followupEm) return 1;
    return a.criadoEm.localeCompare(b.criadoEm);
  });

  return (
    <div>
      <h1 className="mb-2 text-lg font-semibold text-slate-900">Follow-up</h1>
      <p className="mb-6 text-sm text-slate-500">
        Orçamentos enviados que ainda estão à espera de resposta do cliente.
      </p>
      <FollowUpLista linhas={linhas} />
    </div>
  );
}
