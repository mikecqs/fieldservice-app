import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import { ROTULOS_ESTADO } from "@/lib/orcamento-estado";
import ItensEditor from "./ItensEditor";
import DetalhesForm from "./DetalhesForm";
import AcoesEstado from "./AcoesEstado";

export default async function OrcamentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: orcamento } = await supabase
    .from("budgets")
    .select("*, clients(id, nome, empresa, telefone, email, morada, nif), budget_items(*)")
    .eq("id", id)
    .eq("company_id", empresa.id)
    .maybeSingle();

  if (!orcamento) {
    notFound();
  }

  const items = (orcamento.budget_items ?? []) as {
    id: string;
    descricao: string;
    quantidade: number;
    valor_unitario: number;
  }[];
  const totais = calcularOrcamento(items, orcamento.iva_percent);
  const cliente = orcamento.clients as {
    nome: string;
    empresa: string | null;
    telefone: string | null;
    email: string | null;
    morada: string | null;
    nif: string | null;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/orcamentos" className="hover:underline">
            Orçamentos
          </Link>
          <span>/</span>
          <span className="text-slate-800">{orcamento.numero}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{orcamento.numero}</h1>
            <p className="text-sm text-slate-500">
              {cliente.nome}
              {cliente.empresa ? ` — ${cliente.empresa}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {ROTULOS_ESTADO[orcamento.estado as keyof typeof ROTULOS_ESTADO] ?? orcamento.estado}
            </span>
            <a
              href={`/orcamentos/${orcamento.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver PDF
            </a>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Cliente</h2>
        <dl className="grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Telefone</dt>
            <dd>{cliente.telefone || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Email</dt>
            <dd>{cliente.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Morada</dt>
            <dd>{cliente.morada || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">NIF</dt>
            <dd>{cliente.nif || "—"}</dd>
          </div>
        </dl>
      </section>

      <ItensEditor
        budgetId={orcamento.id}
        estado={orcamento.estado}
        items={items}
        ivaPercent={orcamento.iva_percent}
        totais={totais}
      />

      <DetalhesForm
        budgetId={orcamento.id}
        estado={orcamento.estado}
        condicoes={orcamento.condicoes ?? ""}
        notas={orcamento.notas ?? ""}
        validadeDias={orcamento.validade_dias}
        ivaPercent={orcamento.iva_percent}
      />

      <AcoesEstado
        budgetId={orcamento.id}
        estado={orcamento.estado}
        followupEm={orcamento.followup_em}
      />
    </div>
  );
}
