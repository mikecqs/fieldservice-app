import "server-only";
import { headers } from "next/headers";

// Usado só para construir o link de recuperação de password
// (resetPasswordForEmail redirectTo) — precisa do URL absoluto do site em
// que a app está a correr nesse pedido (Preview/Production podem ter
// domínios diferentes, por isso nunca hardcoded).
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  throw new Error("Não foi possível determinar o URL do site a partir do pedido.");
}
