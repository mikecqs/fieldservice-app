import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nexIA",
  description: "nexIA — gestão inteligente de serviços técnicos no terreno",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-neutral-950 text-white antialiased">{children}</body>
    </html>
  );
}
