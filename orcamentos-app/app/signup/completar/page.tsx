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
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">Falta um passo</h1>
        <p className="mb-6 text-sm text-muted">
          Indique o nome da sua empresa para concluir a criação da conta.
        </p>
        <form action={completarEmpresa} className="space-y-4">
          {erro && <p className="text-sm text-red-400">Não foi possível concluir. Tente novamente.</p>}
          <input
            name="nomeEmpresa"
            type="text"
            required
            className="w-full rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
            placeholder="Nome da empresa"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Concluir
          </button>
        </form>
      </div>
    </main>
  );
}
