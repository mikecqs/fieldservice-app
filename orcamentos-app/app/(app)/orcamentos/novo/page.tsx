import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import NovoOrcamentoForm from "./NovoOrcamentoForm";

export default async function NovoOrcamentoPage() {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nome, empresa, telefone")
    .eq("company_id", empresa.id)
    .order("nome");

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/orcamentos" className="hover:text-white hover:underline">
          Orçamentos
        </Link>
        <span>/</span>
        <span className="text-white">Novo</span>
      </div>
      <h1 className="mb-6 text-lg font-semibold tracking-tight text-white">Novo orçamento</h1>
      <NovoOrcamentoForm clientes={clientes ?? []} />
    </div>
  );
}
