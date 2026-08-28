import { requireRole } from "@/lib/auth";
import { FinanceiroSidebar } from "./FinanceiroSidebar";

// Área própria para a role FINANCE — nunca partilha layout com /admin/*, por
// isso nunca aparece um link para Serviços, Clientes, Utilizadores, etc. Mas
// a proteção real não é esta falta de link: é este requireRole (só FINANCE
// entra aqui) e as policies de RLS "finance reads ..." em schema.sql, que
// bloqueiam mesmo um pedido direto à API feito por outra role.
export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["FINANCE"]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 md:flex-row">
      <FinanceiroSidebar orgNome={(profile as any)?.organizations?.nome ?? "—"} nome={profile?.nome} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
