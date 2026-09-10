// Sem isto, uma env var em falta (ex: configurada só para "Production"
// no Vercel, mas não para "Preview") faz o SDK do Supabase falhar de
// forma genérica e pouco clara mais à frente — mais difícil de
// diagnosticar do que uma mensagem direta já na origem.
function obrigatoria(nome: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `${nome} não está definida nesta build. Confirme as env vars no Vercel para o ambiente correto (Production/Preview/Development).`
    );
  }
  return valor;
}

export function supabaseUrl(): string {
  return obrigatoria("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return obrigatoria("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseServiceRoleKey(): string {
  return obrigatoria("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
