import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// A raiz do site só decide para onde mandar o utilizador — o middleware
// já trata da proteção real; isto é só uma conveniência de navegação.
export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "SUPER_ADMIN") redirect("/super-admin");
  if (profile?.role === "ADMIN") redirect("/admin/dashboard");
  redirect("/tecnico");
}
