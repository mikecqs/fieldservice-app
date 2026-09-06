import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serv by Tareo — Gestão operacional para empresas de serviços",
  description: "Serv by Tareo — Gestão operacional para empresas de serviços",
  manifest: "/manifest.json",
  // appleWebApp.title fica curto de propósito: é a legenda mostrada por
  // baixo do ícone no ecrã principal (iOS) — pouco espaço, corta com "…"
  // se for a frase completa.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Serv" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-neutral-950 text-white antialiased">{children}</body>
    </html>
  );
}
