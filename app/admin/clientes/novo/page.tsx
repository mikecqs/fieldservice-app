import Link from "next/link";
import { NovoClienteForm } from "./NovoClienteForm";

export default function NovoClientePage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/clientes" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Clientes
      </Link>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="mb-4 text-lg font-bold text-white">Novo cliente</h1>
        <NovoClienteForm />
      </div>
    </div>
  );
}
