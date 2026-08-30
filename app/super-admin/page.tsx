import { createClient } from "@/lib/supabase/server";
import { criarEmpresa, criarAdminDaEmpresa, criarAtendimentoDaEmpresa, alterarEstadoEmpresa, alterarEstadoUtilizador } from "./actions";
import { ROLE_LABEL } from "@/lib/roles";

export default async function SuperAdminPage() {
  const supabase = createClient();

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, nome, nif, ativa, created_at, profiles(id, nome, email, role, ativo)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Empresas</h1>
        <p className="mt-0.5 text-sm text-neutral-400">
          Cria uma empresa nova por cada cliente que comprar acesso, e o respetivo Admin.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Nova empresa</h2>
        <form action={criarEmpresa} className="flex gap-2">
          <input
            name="nome"
            placeholder="Nome da empresa"
            required
            className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-sm"
          />
          <input
            name="nif"
            placeholder="NIF (opcional)"
            className="w-40 rounded-md border border-neutral-700 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
            Criar
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {(organizations ?? []).map((org: any) => (
          <div key={org.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{org.nome}</h3>
                <p className="text-xs text-neutral-500">NIF {org.nif || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${org.ativa ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-800 text-neutral-400"}`}>
                  {org.ativa ? "Ativa" : "Inativa (freeze)"}
                </span>
                <form action={alterarEstadoEmpresa}>
                  <input type="hidden" name="id" value={org.id} />
                  <input type="hidden" name="ativa" value={org.ativa ? "false" : "true"} />
                  <button
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      org.ativa
                        ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                        : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    }`}
                  >
                    {org.ativa ? "Congelar empresa" : "Reativar empresa"}
                  </button>
                </form>
              </div>
            </div>

            {org.profiles?.length > 0 ? (
              <div className="mb-3 space-y-1">
                {org.profiles.map((p: any) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-200">
                      {ROLE_LABEL[p.role] ?? p.role}
                    </span>
                    <span>{p.nome} · {p.email}</span>
                    {p.ativo === false && (
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Desativado</span>
                    )}
                    {p.role !== "SUPER_ADMIN" && (
                      <form action={alterarEstadoUtilizador} className="ml-auto">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="ativo" value={p.ativo === false ? "true" : "false"} />
                        <button className="text-xs text-neutral-400 underline hover:text-white">
                          {p.ativo === false ? "Reativar" : "Desativar"}
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-amber-400">Ainda sem Admin — cria o primeiro acesso abaixo.</p>
            )}

            <details className="rounded-md border border-neutral-800 bg-neutral-800 p-3">
              <summary className="cursor-pointer text-xs font-medium text-neutral-300">
                Criar acesso de Admin para esta empresa
              </summary>
              <form action={criarAdminDaEmpresa} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input type="hidden" name="organization_id" value={org.id} />
                <input name="nome" placeholder="Nome do admin" required className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
                <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
                <input name="password" type="password" placeholder="Palavra-passe inicial" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
                <button type="submit" className="col-span-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
                  Criar Admin
                </button>
              </form>
            </details>

            <details className="mt-2 rounded-md border border-neutral-800 bg-neutral-800 p-3">
              <summary className="cursor-pointer text-xs font-medium text-neutral-300">
                Criar acesso de Atendimento para esta empresa
              </summary>
              <p className="mt-2 text-xs text-neutral-500">
                Só o Super Admin cria este acesso — substitui os pedidos em papel na loja, sem acesso a áreas
                administrativas.
              </p>
              <form action={criarAtendimentoDaEmpresa} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input type="hidden" name="organization_id" value={org.id} />
                <input name="nome" placeholder="Nome" required className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
                <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
                <input name="password" type="password" placeholder="Palavra-passe inicial" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
                <button type="submit" className="col-span-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
                  Criar Atendimento
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
