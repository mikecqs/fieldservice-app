import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cliente para Server Components, Server Actions e Route Handlers — lê/escreve
// a sessão via cookies do pedido.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions)
            );
          } catch {
            // chamado a partir de um Server Component sem permissão de
            // escrita de cookies — seguro ignorar, o middleware trata do refresh.
          }
        },
      },
    }
  );
}

// Service role — só para o upload/remoção do logo em storage.objects, onde
// a policy de RLS depende de auth.uid() e o upload corre a partir de uma
// Server Action que já validou a empresa do próprio utilizador antes de
// chamar isto. Nunca importar num componente "use client".
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
