import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NovoServicoForm } from "./NovoServicoForm";

export default async function NovoServicoPage() {
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, nome, client_addresses(id, label, endereco)")
    .order("nome");

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/servicos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Serviços
      </Link>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="mb-4 text-lg font-bold text-white">Novo serviço</h1>
        {(clients ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">
            Precisas de ter pelo menos um cliente criado. <Link href="/admin/clientes/novo" className="text-neutral-200 underline">Criar cliente</Link>.
          </p>
        ) : (
          <NovoServicoForm clientesIniciais={(clients ?? []) as any} />
        )}
      </div>
    </div>
  );
}
