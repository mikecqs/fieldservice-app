import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientesLista, type ClienteResumo } from "./ClientesLista";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, codigo, nome, empresa, telefone, nif, client_addresses(label, endereco)")
    .order("nome");

  const resumo: ClienteResumo[] = (clients ?? []).map((c: any) => ({
    id: c.id,
    codigo: c.codigo,
    nome: c.nome,
    empresa: c.empresa,
    telefone: c.telefone,
    nif: c.nif,
    // Texto simples com todas as moradas juntas, só para a pesquisa — a
    // lista continua a mostrar apenas a contagem, como já acontecia.
    moradas: (c.client_addresses ?? []).map((a: any) => `${a.label} ${a.endereco}`).join(" "),
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
