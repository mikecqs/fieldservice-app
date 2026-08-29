import { requireRole } from "@/lib/auth";
import { AtendimentoSidebar } from "./AtendimentoSidebar";

// Área própria para a role ATENDIMENTO — substitui os pedidos em papel da
// loja física. Nunca partilha layout com /admin/*, por isso não há sequer
// um link para Dashboard, Serviços, Orçamentos, Faturação, Utilizadores,
// etc. Mas a proteção real não é a falta de link: é este requireRole (só
// ATENDIMENTO entra aqui) e as policies "atendimento ..." em schema.sql —
// que só dão SELECT/INSERT em clients/client_addresses/requests, nada mais
// — por isso mesmo um pedido direto a /admin/* ou a outra tabela qualquer
// nunca devolve dados.
export default async function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["ATENDIMENTO"]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-neutral-950 md:flex-row">
      <AtendimentoSidebar orgNome={(profile as any)?.organizations?.nome ?? "—"} nome={profile?.nome} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
