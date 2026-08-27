import { createClient } from "@/lib/supabase/server";
import { criarEmpresa, criarAdminDaEmpresa } from "./actions";

export default async function SuperAdminPage() {
  const supabase = createClient();

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, nome, nif, ativa, created_at, profiles(id, nome, email, role)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Empresas</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Cria uma empresa nova por cada cliente que comprar acesso, e o respetivo Admin.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Nova empresa</h2>
        <form action={criarEmpresa} className="flex gap-2">
          <input
            name="nome"
            placeholder="Nome da empresa"
            required
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="nif"
            placeholder="NIF (opcional)"
            className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-indigo-900 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">
            Criar
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {(organizations ?? []).map((org: any) => (
          <div key={org.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{org.nome}</h3>
                <p className="text-xs text-slate-400">NIF {org.nif || "—"}</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${org.ativa ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                {org.ativa ? "Ativa" : "Inativa"}
              </span>
            </div>

            {org.profiles?.length > 0 ? (
              <div className="mb-3 space-y-1">
                {org.profiles.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                      {p.role === "ADMIN" ? "Admin" : "Técnico"}
                    </span>
                    {p.nome} · {p.email}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-amber-700">Ainda sem Admin — cria o primeiro acesso abaixo.</p>
            )}

            <details className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                Criar acesso de Admin para esta empresa
              </summary>
              <form action={criarAdminDaEmpresa} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input type="hidden" name="organization_id" value={org.id} />
                <input name="nome" placeholder="Nome do admin" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input name="email" type="email" placeholder="Email" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input name="password" type="password" placeholder="Palavra-passe inicial" required className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <button type="submit" className="col-span-2 rounded-md bg-indigo-900 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800">
                  Criar Admin
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
