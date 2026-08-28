import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { NexiaMark } from "@/components/NexiaMark";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["SUPER_ADMIN"]);

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-4 text-white">
        <div className="flex items-center gap-2">
          <NexiaMark size={32} />
          <span className="font-bold">nexIA · Super Admin</span>
        </div>
        <SignOutButton className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium hover:bg-neutral-700" />
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
