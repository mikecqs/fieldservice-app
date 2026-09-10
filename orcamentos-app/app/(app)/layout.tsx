import { requireCompany } from "@/lib/auth";
import Sidebar from "./Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const empresa = await requireCompany();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface-base md:flex-row">
      <Sidebar empresaNome={empresa.nome} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
