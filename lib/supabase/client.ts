import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para usar em Client Components ("use client").
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
