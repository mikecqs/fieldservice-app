import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import DadosEmpresaForm from "./DadosEmpresaForm";
import LogoForm from "./LogoForm";

export default async function EmpresaPage() {
  const empresa = await requireCompany();
  const supabase = await createClient();

  let logoUrl: string | null = null;
  if (empresa.logo_path) {
    const { data } = await supabase.storage.from("logos").createSignedUrl(empresa.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold tracking-tight text-white">Empresa</h1>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <LogoForm logoUrl={logoUrl} />
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <DadosEmpresaForm empresa={empresa} />
      </section>
    </div>
  );
}
