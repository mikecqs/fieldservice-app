import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase para usar em Server Components, Server Actions e Route Handlers.
// Lê/escreve a sessão através dos cookies do pedido — é o que garante que o
// utilizador continua autenticado entre navegações no App Router.
export function createClient() {
  const cookieStore = cookies();

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
            // chamado a partir de um Server Component sem permissão de escrita
            // de cookies — é seguro ignorar, o middleware trata do refresh.
          }
        },
      },
    }
  );
}

// Cliente com a service role key — só para usar em server actions que
// precisam de privilégios administrativos (ex: criar utilizadores).
// NUNCA importar este ficheiro num componente que corre no browser.
export function createAdminClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
