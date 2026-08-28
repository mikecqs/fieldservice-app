"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const NAV = [
  { href: "/financeiro", label: "Dashboard" },
  { href: "/financeiro/faturacao", label: "Faturação" },
  { href: "/financeiro/pendencias", label: "Pendências" },
  { href: "/financeiro/historico", label: "Histórico" },
];

export function FinanceiroSidebar({ orgNome, nome }: { orgNome: string; nome?: string }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-indigo-950 px-4 py-3 text-white md:hidden">
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="rounded-md p-1 text-indigo-200 hover:bg-indigo-900 hover:text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-sm font-bold">nexIA · Financeiro</span>
        <span className="w-[22px]" />
      </div>

      {aberto && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setAberto(false)} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-slate-200 bg-indigo-950 text-slate-200 transition-transform duration-200 md:static md:w-56 md:translate-x-0 ${
          aberto ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 font-mono text-sm font-bold text-white">
            nX
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-white">nexIA</div>
            <div className="text-[11px] leading-tight text-indigo-300">{orgNome}</div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className={`block rounded-md px-3 py-2 text-sm hover:bg-indigo-900 hover:text-white ${
                pathname === item.href ? "bg-indigo-900 text-white" : "text-indigo-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-indigo-900 p-3">
          <div className="mb-2 px-1 text-xs text-indigo-300">{nome}</div>
          <SignOutButton className="w-full rounded-md bg-indigo-900 px-3 py-2 text-left text-xs font-medium text-indigo-100 hover:bg-indigo-800" />
        </div>
      </aside>
    </>
  );
}
