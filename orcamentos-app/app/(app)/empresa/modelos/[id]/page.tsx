import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import ItensEditorModelo from "./ItensEditorModelo";
import DetalhesModeloForm from "./DetalhesModeloForm";

export default async function ModeloDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: modelo } = await supabase
    .from("budget_templates")
    .select("*, budget_template_items(*)")
    .eq("id", id)
    .eq("company_id", empresa.id)
    .maybeSingle();

  if (!modelo) {
    notFound();
  }

  const items = (modelo.budget_template_items ?? []) as {
    id: string;
    descricao: string;
    quantidade: number;
    valor_unitario: number;
  }[];
  const totais = calcularOrcamento(items, modelo.iva_percent);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted">
        <Link href="/empresa" className="hover:text-white hover:underline">
          Empresa
        </Link>
        <span>/</span>
        <span className="text-white">{modelo.nome}</span>
      </div>

      <h1 className="text-lg font-semibold tracking-tight text-white">{modelo.nome}</h1>

      <ItensEditorModelo templateId={modelo.id} items={items} ivaPercent={modelo.iva_percent} totais={totais} />

      <DetalhesModeloForm
        templateId={modelo.id}
        nome={modelo.nome}
        condicoes={modelo.condicoes ?? ""}
        validadeDias={modelo.validade_dias}
        ivaPercent={modelo.iva_percent}
      />
    </div>
  );
}
