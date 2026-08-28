import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { NexiaMark } from "@/components/NexiaMark";

// Reparem no que NÃO existe aqui: não há nenhum botão "ver como Admin", nem
// link para nenhuma rota /admin/*. Isso não é uma omissão de design — mesmo
// que fosse adicionado por engano, o requireRole abaixo bloquearia o acesso
// e a RLS bloquearia as queries. Mas ao nem sequer o pormos na interface, o
// técnico não é confrontado com opções que não pode usar.
export default async function TecnicoLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["TECHNICIAN"]);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-neutral-950">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <NexiaMark size={30} />
          <div>
            <div className="text-[11px] leading-tight text-neutral-500">Olá,</div>
            <div className="text-base font-bold leading-tight">{profile?.nome}</div>
          </div>
        </div>
        <SignOutButton className="rounded-md border border-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-900" />
      </div>
      {children}
    </div>
  );
}
