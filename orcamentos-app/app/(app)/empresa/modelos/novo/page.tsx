import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { LIMITE_MODELOS } from "../constantes";
import NovoModeloForm from "./NovoModeloForm";

export default async function NovoModeloPage() {
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { count } = await supabase
    .from("budget_templates")
    .select("id", { count: "exact", head: true })
    .eq("company_id", empresa.id);

  const atingiuLimite = (count ?? 0) >= LIMITE_MODELOS;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/empresa" className="hover:text-white hover:underline">
          Empresa
        </Link>
        <span>/</span>
        <span className="text-white">Novo modelo</span>
      </div>
      <h1 className="mb-6 text-lg font-semibold tracking-tight text-white">Novo modelo de orçamento</h1>

      {atingiuLimite ? (
        <p className="rounded-2xl border border-edge bg-surface p-6 text-sm text-muted">
          Já tem {LIMITE_MODELOS} modelos criados. Apague um em{" "}
          <Link href="/empresa" className="text-white hover:underline">
            Empresa
          </Link>{" "}
          antes de criar outro.
        </p>
      ) : (
        <NovoModeloForm />
      )}
    </div>
  );
}
