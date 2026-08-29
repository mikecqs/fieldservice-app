import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientesLista, type ClienteResumo } from "./ClientesLista";

export default async function ClientesPage() {
  const supabase = createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, codigo, nome, empresa, telefone, client_addresses(id)")
    .order("nome");

  const resumo: ClienteResumo[] = (clients ?? []).map((c: any) => ({
    id: c.id,
    codigo: c.codigo,
    nome: c.nome,
    empresa: c.empresa,
    telefone: c.telefone,
    totalMoradas: (c.client_addresses ?? []).length,
  }));

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            Cada cliente pode ter várias moradas e um histórico completo.
          </p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Novo cliente
        </Link>
      </div>

      <ClientesLista clientes={resumo} />
    </div>
  );
}
