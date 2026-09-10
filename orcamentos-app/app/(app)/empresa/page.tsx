import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import DadosEmpresaForm from "./DadosEmpresaForm";
import LogoForm from "./LogoForm";
import { LIMITE_MODELOS } from "./modelos/constantes";

export default async function EmpresaPage() {
  const empresa = await requireCompany();
  const supabase = await createClient();

  let logoUrl: string | null = null;
  if (empresa.logo_path) {
    const { data } = await supabase.storage.from("logos").createSignedUrl(empresa.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  const { data: modelos } = await supabase
    .from("budget_templates")
    .select("id, nome, budget_template_items(id)")
    .eq("company_id", empresa.id)
    .order("created_at");

  const listaModelos = modelos ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold tracking-tight text-white">Empresa</h1>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <LogoForm logoUrl={logoUrl} />
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <DadosEmpresaForm empresa={empresa} />
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">Modelos de orçamento</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Até {LIMITE_MODELOS} modelos com itens/condições pré-definidos, para usar ao criar um orçamento novo.
            </p>
          </div>
          {listaModelos.length < LIMITE_MODELOS && (
            <Link
              href="/empresa/modelos/novo"
              className="shrink-0 rounded-md border border-edge-subtle px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
            >
              Criar modelo
            </Link>
          )}
        </div>

        {listaModelos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não criou nenhum modelo.</p>
        ) : (
          <ul className="space-y-2">
            {listaModelos.map((modelo) => {
              const numItens = (modelo.budget_template_items ?? []).length;
              return (
                <li key={modelo.id}>
                  <Link
                    href={`/empresa/modelos/${modelo.id}`}
                    className="flex items-center justify-between rounded-xl border border-edge px-4 py-3 transition-colors hover:border-edge-subtle hover:bg-surface-raised"
                  >
                    <span className="text-sm font-medium text-white">{modelo.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {numItens} {numItens === 1 ? "item" : "itens"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
