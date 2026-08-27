import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldService",
  description: "Gestão de serviços técnicos no terreno",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
