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
        <h1 className="text-xl font-bold text-slate-900">Utilizadores</h1>
        <p className="mt-0.5 text-sm text-slate-500">Admins e técnicos com acesso a esta empresa.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Novo utilizador</h2>
        <form action={criarUtilizador} className="grid grid-cols-2 gap-3">
          <input name="nome" placeholder="Nome" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select name="role" defaultValue="TECHNICIAN" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="TECHNICIAN">Técnico</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input name="email" type="email" placeholder="Email" required className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="password" type="password" placeholder="Palavra-passe inicial" required className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button className="col-span-2 rounded-md bg-indigo-900 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800">
            Criar utilizador
          </button>
        </form>
      </div>

      <div className="space-y-1.5">
        {(utilizadores ?? []).map((u: any) => (
          <div key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3.5 text-sm">
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
              {u.role === "ADMIN" ? "Admin" : "Técnico"}
            </span>
            <span className="font-medium text-slate-800">{u.nome}</span>
            <span className="text-slate-400">{u.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
