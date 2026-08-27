import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["SUPER_ADMIN"]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-indigo-950 px-6 py-4 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 font-mono text-sm font-bold">
            FS
          </div>
          <span className="font-bold">FieldService · Super Admin</span>
        </div>
        <SignOutButton className="rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium hover:bg-indigo-800" />
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
