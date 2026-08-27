import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ClientesPage() {
  const supabase = createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, nome, empresa, telefone, client_addresses(id)")
    .order("nome");

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Cada cliente pode ter várias moradas e um histórico completo.
          </p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800"
        >
          Novo cliente
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(clients ?? []).map((c: any) => (
          <Link
            key={c.id}
            href={`/admin/clientes/${c.id}`}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-800">{c.nome}</div>
              <div className="truncate text-xs text-slate-400">
                {(c.client_addresses ?? []).length} morada(s) · {c.telefone}
              </div>
            </div>
          </Link>
        ))}
        {(clients ?? []).length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-slate-400">
            Ainda sem clientes — cria o primeiro.
          </p>
        )}
      </div>
    </div>
  );
}
