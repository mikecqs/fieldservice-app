import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/atencao", label: "Atenção" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/orcamentos", label: "Orçamentos" },
  { href: "/admin/materiais", label: "Materiais" },
  { href: "/admin/compras", label: "Compras" },
  { href: "/admin/faturacao", label: "Faturação" },
  { href: "/admin/relatorios", label: "Relatórios" },
  { href: "/admin/utilizadores", label: "Utilizadores" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // A proteção real da rota /admin/* é esta verificação (redireciona quem
  // não for ADMIN/SUPER_ADMIN) e as policies de RLS nas tabelas — por isso
  // não há forma de um pedido direto à API devolver dados de outra empresa,
  // mesmo que este layout fosse contornado.
  const profile = await requireRole(["ADMIN", "SUPER_ADMIN"]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-indigo-950 text-slate-200">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 font-mono text-sm font-bold text-white">
            FS
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-white">FieldService</div>
            <div className="text-[11px] leading-tight text-indigo-300">
              {(profile as any)?.organizations?.nome ?? "—"}
            </div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-900 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-indigo-900 p-3">
          <div className="mb-2 px-1 text-xs text-indigo-300">{profile?.nome}</div>
          <SignOutButton className="w-full rounded-md bg-indigo-900 px-3 py-2 text-left text-xs font-medium text-indigo-100 hover:bg-indigo-800" />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
