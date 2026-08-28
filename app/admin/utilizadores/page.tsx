import { createClient } from "@/lib/supabase/server";
import { criarUtilizador } from "./actions";

export default async function UtilizadoresPage() {
  const supabase = createClient();
  const { data: utilizadores } = await supabase
    .from("profiles")
    .select("id, nome, email, role")
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
        <form action={criarUtilizador} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="nome" placeholder="Nome" required className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
          <select name="role" defaultValue="TECHNICIAN" className="rounded-md border border-neutral-700 px-3 py-2 text-sm">
            <option value="TECHNICIAN">Técnico</option>
            <option value="ADMIN">Admin</option>
            <option value="FINANCE">Financeiro</option>
          </select>
          <input name="email" type="email" placeholder="Email" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
          <input name="password" type="password" placeholder="Palavra-passe inicial" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
          <button className="col-span-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
            Criar utilizador
          </button>
        </form>
      </div>

      <div className="space-y-1.5">
        {(utilizadores ?? []).map((u: any) => (
          <div key={u.id} className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3.5 text-sm">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-200">
              {u.role === "ADMIN" ? "Admin" : u.role === "FINANCE" ? "Financeiro" : "Técnico"}
            </span>
            <span className="font-medium text-neutral-100">{u.nome}</span>
            <span className="text-neutral-500">{u.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
