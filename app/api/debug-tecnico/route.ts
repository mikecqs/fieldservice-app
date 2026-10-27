import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ROTA TEMPORÁRIA DE DIAGNÓSTICO — remover depois de resolver o problema.
// Aceder em: /api/debug-tecnico (estando autenticado como técnico)
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  // 1. Quem está autenticado?
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Sem sessão autenticada", detalhe: userError?.message });
  }

  // 2. Qual é o perfil?
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nome, role, organization_id, ativo")
    .eq("id", user.id)
    .single();

  // 3. Quantas entradas tem em service_technicians?
  const { data: stRows, error: stError } = await supabase
    .from("service_technicians")
    .select("service_id, user_id")
    .eq("user_id", user.id);

  // 4. O que a view devolve?
  const { data: viewRows, error: viewError } = await supabase
    .from("services_technician_view")
    .select("id, estado, data_agendada, hora_agendada, cliente_nome");

  // 5. Testar se a view existe (tentar um select direto com count)
  const { count: viewCount, error: viewCountError } = await supabase
    .from("services_technician_view")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    auth_uid: user.id,
    auth_email: user.email,
    profile: profile ?? null,
    profile_error: profileError?.message ?? null,
    service_technicians_count: stRows?.length ?? 0,
    service_technicians_error: stError?.message ?? null,
    service_technicians_sample: stRows?.slice(0, 5) ?? [],
    view_rows_count: viewRows?.length ?? 0,
    view_error: viewError?.message ?? null,
    view_count_exact: viewCount ?? null,
    view_count_error: viewCountError?.message ?? null,
    view_sample: viewRows?.slice(0, 5) ?? [],
  });
}
