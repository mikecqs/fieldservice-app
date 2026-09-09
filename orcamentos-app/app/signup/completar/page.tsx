import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completarEmpresa } from "./actions";

// Só é alcançada se existir sessão mas ainda não existir linha em
// `companies` para este utilizador (ver lib/auth.ts) — normalmente nunca,
// exceto se o signup foi interrompido a meio.
export default async function CompletarSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (company) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Falta um passo</h1>
        <p className="mb-6 text-sm text-slate-500">
          Indique o nome da sua empresa para concluir a criação da conta.
        </p>
        <form action={completarEmpresa} className="space-y-4">
          {erro && <p className="text-sm text-red-600">Não foi possível concluir. Tente novamente.</p>}
          <input
            name="nomeEmpresa"
            type="text"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Nome da empresa"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Concluir
          </button>
        </form>
      </div>
    </main>
  );
}
