import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import EstadoBadge from "../../EstadoBadge";
import ItensEditor from "./ItensEditor";
import DetalhesForm from "./DetalhesForm";
import AcoesEstado from "./AcoesEstado";
import AcoesPartilha from "./AcoesPartilha";
import Historico from "./Historico";

export default async function OrcamentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresa = await requireCompany();
  const supabase = await createClient();

  const [{ data: orcamento }, { data: eventos }] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, clients(id, nome, empresa, telefone, email, morada, nif), budget_items(*)")
      .eq("id", id)
      .eq("company_id", empresa.id)
      .maybeSingle(),
    supabase
      .from("budget_events")
      .select("id, tipo, descricao, created_at")
      .eq("budget_id", id)
      .order("created_at", { ascending: false }),
  ]);

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
        <div className="mb-2 flex items-center gap-2 text-sm text-muted">
          <Link href="/orcamentos" className="hover:text-white hover:underline">
            Orçamentos
          </Link>
          <span>/</span>
          <span className="text-white">{orcamento.numero}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">{orcamento.numero}</h1>
            <p className="text-sm text-muted">
              {cliente.nome}
              {cliente.empresa ? ` — ${cliente.empresa}` : ""}
            </p>
          </div>
          <EstadoBadge estado={orcamento.estado} />
        </div>
        <div className="mt-4">
          <AcoesPartilha
            budgetId={orcamento.id}
            numero={orcamento.numero}
            total={totais.total}
            clienteNome={cliente.nome}
            clienteTelefone={cliente.telefone}
            clienteEmail={cliente.email}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">Cliente</h2>
        <dl className="grid grid-cols-1 gap-2 text-sm text-muted sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Telefone</dt>
            <dd>{cliente.telefone || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{cliente.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Morada</dt>
            <dd>{cliente.morada || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">NIF</dt>
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

      <Historico eventos={eventos ?? []} />
    </div>
  );
}
