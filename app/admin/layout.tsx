import { requireRole } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // A proteção real da rota /admin/* é esta verificação (redireciona quem
  // não for ADMIN/SUPER_ADMIN) e as policies de RLS nas tabelas — por isso
  // não há forma de um pedido direto à API devolver dados de outra empresa,
  // mesmo que este layout fosse contornado.
  const profile = await requireRole(["ADMIN", "SUPER_ADMIN"]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 md:flex-row">
      <AdminSidebar orgNome={(profile as any)?.organizations?.nome ?? "—"} nome={profile?.nome} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
