"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { NexiaMark } from "@/components/NexiaMark";

// Onda 3 (Etapa 6) — agrupados por frequência de uso na operação diária
// (auditoria Onda 3, ponto 6). "Compras" ocultado por decisão de produto
// (temporário) — rota, RLS e ações continuam intactas, só sem entrada
// visual no menu.
const NAV_GROUPS: { titulo: string; itens: { href: string; label: string }[] }[] = [
  {
    titulo: "Operação",
    itens: [
      { href: "/admin/dashboard", label: "Dashboard" },
      { href: "/admin/pedidos", label: "Pedidos" },
      { href: "/admin/agenda", label: "Agenda" },
      { href: "/admin/clientes", label: "Clientes" },
      { href: "/admin/servicos", label: "Serviços" },
    ],
  },
  {
    titulo: "Negócio",
    itens: [
      { href: "/admin/orcamentos", label: "Orçamentos" },
      { href: "/admin/catalogo", label: "Catálogo" },
      { href: "/admin/faturacao", label: "Financeiro" },
      { href: "/admin/financeiro", label: "Relatórios Financeiros" },
      { href: "/admin/relatorios", label: "Relatórios" },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/admin/utilizadores", label: "Utilizadores" },
      { href: "/admin/configuracoes", label: "Configurações" },
    ],
  },
];

export function AdminSidebar({ orgNome, nome }: { orgNome: string; nome?: string }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-white md:hidden">
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="rounded-md p-1 text-neutral-400 hover:bg-white hover:text-neutral-950"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-sm font-bold">nexIA</span>
        <span className="w-[22px]" />
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setAberto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-neutral-800 bg-neutral-950 text-neutral-700 transition-transform duration-200 md:static md:w-56 md:translate-x-0 ${
          aberto ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <NexiaMark size={32} />
          <div>
            <div className="text-sm font-bold leading-tight text-white">nexIA</div>
            <div className="text-[11px] leading-tight text-neutral-400">{orgNome}</div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-4 overflow-y-auto px-2">
          {NAV_GROUPS.map((grupo) => (
            <div key={grupo.titulo}>
              <h2 className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                {grupo.titulo}
              </h2>
              <div className="space-y-0.5">
                {grupo.itens.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAberto(false)}
                    className={`block rounded-md px-3 py-2 text-sm hover:bg-white hover:text-neutral-950 ${
                      pathname === item.href ? "bg-white text-neutral-950" : "text-neutral-400"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-neutral-700 p-3">
          <div className="mb-2 px-1 text-xs text-neutral-400">{nome}</div>
          <SignOutButton className="w-full rounded-md bg-neutral-800 px-3 py-2 text-left text-xs font-medium text-neutral-300 hover:bg-neutral-700" />
        </div>
      </aside>
    </>
  );
}
