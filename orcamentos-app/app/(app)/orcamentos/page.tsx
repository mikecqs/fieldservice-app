import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import OrcamentosLista, { type OrcamentoLinha } from "./OrcamentosLista";

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: orcamentos } = await supabase
    .from("budgets")
    .select("id, numero, estado, criado_em, followup_em, iva_percent, clients(nome, empresa, telefone, morada, nif), budget_items(quantidade, valor_unitario)")
    .eq("company_id", empresa.id)
    .order("criado_em", { ascending: false });

  const linhas: OrcamentoLinha[] = (orcamentos ?? []).map((orcamento) => {
    const cliente = orcamento.clients as unknown as {
      nome: string;
      empresa: string | null;
      telefone: string | null;
      morada: string | null;
      nif: string | null;
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
      clienteMorada: cliente?.morada ?? "",
      clienteNif: cliente?.nif ?? "",
    };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-white">Orçamentos</h1>
        <Link
          href="/orcamentos/novo"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-transform duration-200 hover:scale-[1.02] hover:bg-neutral-200"
        >
          Novo orçamento
        </Link>
      </div>
      <OrcamentosLista linhas={linhas} estadoInicial={estado} />
    </div>
  );
}
