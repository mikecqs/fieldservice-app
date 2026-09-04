import { createClient } from "@/lib/supabase/server";
import { NovoUtilizadorForm } from "./NovoUtilizadorForm";
import { AcoesUtilizador } from "./AcoesUtilizador";
import { ROLE_LABEL } from "@/lib/roles";

// ATENDIMENTO pode aparecer aqui em modo só-leitura (a policy "org members
// can read colleagues" deixa qualquer perfil da empresa ver os colegas) —
// mas o Admin nunca o consegue criar: o <select> abaixo só oferece
// TECHNICIAN/ADMIN/FINANCE, e a policy "admin can manage profiles in own
// org" em schema.sql rejeita qualquer tentativa de insert/update com
// role='ATENDIMENTO', mesmo por fora desta página.

export default async function UtilizadoresPage() {
  const supabase = await createClient();
  const { data: utilizadores } = await supabase
    .from("profiles")
    .select("id, nome, email, role, ativo")
    .order("role")
    .order("nome");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Utilizadores</h1>
        <p className="mt-0.5 text-sm text-neutral-400">Admins e técnicos com acesso a esta empresa.</p>
      </div>

      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Novo utilizador</h2>
        <NovoUtilizadorForm />
      </div>

      <div className="space-y-1.5">
        {(utilizadores ?? []).map((u: any) => (
          <div
            key={u.id}
            className={`flex flex-wrap items-center gap-2 rounded-lg border p-3.5 text-sm ${
              u.ativo === false ? "border-neutral-800 bg-neutral-900/50 opacity-60" : "border-neutral-800 bg-neutral-900"
            }`}
          >
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-200">
              {ROLE_LABEL[u.role] ?? u.role}
            </span>
            <span className="font-medium text-neutral-100">{u.nome}</span>
            <span className="text-neutral-500">{u.email}</span>
            {u.ativo === false && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Desativado</span>
            )}
            {u.role !== "SUPER_ADMIN" && <AcoesUtilizador id={u.id} ativo={u.ativo !== false} />}
          </div>
        ))}
      </div>
    </div>
  );
}
