"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const ativo = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        ativo ? "bg-surface-raised text-white" : "text-muted hover:bg-surface-raised hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
