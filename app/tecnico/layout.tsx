import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

// Reparem no que NÃO existe aqui: não há nenhum botão "ver como Admin", nem
// link para nenhuma rota /admin/*. Isso não é uma omissão de design — mesmo
// que fosse adicionado por engano, o requireRole abaixo bloquearia o acesso
// e a RLS bloquearia as queries. Mas ao nem sequer o pormos na interface, o
// técnico não é confrontado com opções que não pode usar.
export default async function TecnicoLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["TECHNICIAN"]);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-100">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-indigo-950 px-4 py-4 text-white">
        <div>
          <div className="text-xs text-indigo-300">Olá,</div>
          <div className="text-lg font-bold">{profile?.nome}</div>
        </div>
        <SignOutButton className="rounded-md bg-indigo-900 px-2.5 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-800" />
      </div>
      {children}
    </div>
  );
}
