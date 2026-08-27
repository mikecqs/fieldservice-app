import Link from "next/link";
import { criarCliente } from "../actions";

export default function NovoClientePage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/clientes" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Clientes
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold text-slate-900">Novo cliente</h1>
        <form action={criarCliente} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Nome</span>
            <input name="nome" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Empresa (opcional)</span>
            <input name="empresa" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">NIF</span>
            <input name="nif" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Telefone</span>
            <input name="telefone" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
            <input name="email" type="email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Morada</span>
            <input name="endereco" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Link href="/admin/clientes" className="rounded-md border border-slate-300 px-3.5 py-2 text-sm text-slate-700">
              Cancelar
            </Link>
            <button type="submit" className="rounded-md bg-indigo-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800">
              Guardar cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
