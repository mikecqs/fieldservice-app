"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function completarEmpresa(formData: FormData): Promise<void> {
  const nomeEmpresa = String(formData.get("nomeEmpresa") ?? "").trim();
  if (!nomeEmpresa) {
    redirect("/signup/completar?erro=1");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("companies").insert({
    nome: nomeEmpresa,
    user_id: user.id,
  });

  if (error) {
    redirect("/signup/completar?erro=1");
  }

  redirect("/dashboard");
}
