import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tareo",
  description: "Tareo — gestão inteligente de serviços técnicos no terreno",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Tareo" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-neutral-950 text-white antialiased">{children}</body>
    </html>
  );
}
