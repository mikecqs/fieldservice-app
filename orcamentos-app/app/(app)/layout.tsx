import { requireCompany } from "@/lib/auth";
import NavLink from "./NavLink";
import { sair } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const empresa = await requireCompany();

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-40 border-b border-edge/60 bg-surface-base/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold tracking-tight text-white">{empresa.nome}</span>
            <nav className="flex gap-1">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/orcamentos">Orçamentos</NavLink>
              <NavLink href="/follow-up">Follow-up</NavLink>
              <NavLink href="/empresa">Empresa</NavLink>
            </nav>
          </div>
          <form action={sair}>
            <button type="submit" className="text-sm text-muted hover:text-white">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
