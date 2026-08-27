import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export function homeForRole(role?: string) {
  if (role === "SUPER_ADMIN") return "/super-admin";
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "TECHNICIAN") return "/tecnico";
  return "/login";
}

// Confirma que o utilizador autenticado tem uma das roles permitidas para a
// área atual (admin/super-admin/tecnico) e devolve o seu perfil. Caso
// contrário, manda-o para a área que lhe corresponde. Isto corre em Node.js
// normal (layouts de Server Component), não no middleware — ver nota em
// middleware.ts sobre porque a verificação de role foi movida para aqui.
export async function requireRole(allowed: string[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, role, organization_id, organizations(nome)")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | undefined;
  if (!role || !allowed.includes(role)) {
    redirect(homeForRole(role));
  }

  return profile;
}

// Usado dentro de server actions de /admin/* para saber em que empresa o
// Admin autenticado está a operar. Nunca vem do formulário — mesmo que
// alguém adultere o pedido, a RLS de cada tabela só aceita organization_id
// igual ao do próprio utilizador, por isso um valor forjado seria rejeitado.
export async function getOrgId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();
  return profile!.organization_id as string;
}
