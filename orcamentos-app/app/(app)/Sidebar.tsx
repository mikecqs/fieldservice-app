"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "./actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orcamentos", label: "Orçamentos" },
  { href: "/follow-up", label: "Follow-up" },
  { href: "/empresa", label: "Empresa" },
];

export default function Sidebar({ empresaNome }: { empresaNome: string }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Barra superior só em mobile — o menu abre como gaveta lateral em
          vez de uma nav horizontal, que obrigava a scroll lateral em ecrãs
          estreitos. */}
      <div className="flex shrink-0 items-center justify-between border-b border-edge bg-surface-base px-4 py-3 md:hidden">
        <span className="text-sm font-semibold tracking-tight text-white">{empresaNome}</span>
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="rounded-md p-1.5 text-neutral-200 hover:bg-surface-raised"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <line x1="2" y1="5" x2="18" y2="5" />
            <line x1="2" y1="10" x2="18" y2="10" />
            <line x1="2" y1="15" x2="18" y2="15" />
          </svg>
        </button>
      </div>

      {aberto && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setAberto(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-edge bg-surface-base transition-transform duration-200 md:static md:w-56 md:translate-x-0 ${
          aberto ? "translate-x-0" : ""
        }`}
      >
        <div className="hidden border-b border-edge px-4 py-4 md:block">
          <span className="text-sm font-semibold tracking-tight text-white">{empresaNome}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  ativo ? "bg-white text-neutral-950" : "text-muted hover:bg-surface-raised hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={sair} className="border-t border-edge p-3">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-raised hover:text-white"
          >
            Sair
          </button>
        </form>
      </aside>
    </>
  );
}
