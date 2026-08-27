"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function criarCliente(formData: FormData) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const nome = String(formData.get("nome") || "");
  const empresa = String(formData.get("empresa") || "");
  const nif = String(formData.get("nif") || "");
  const telefone = String(formData.get("telefone") || "");
  const email = String(formData.get("email") || "");
  const endereco = String(formData.get("endereco") || "");

  if (!nome) return;

  // organization_id vem do perfil autenticado, nunca do formulário —
  // mesmo que alguém adultere o pedido, a RLS de "clients" só aceita
  // insert com organization_id igual à do próprio utilizador (ver
  // policy "admin manages clients" no schema.sql), por isso um valor
  // forjado aqui seria sempre rejeitado pela base de dados.
  const { data: cliente, error } = await supabase
    .from("clients")
    .insert({
      organization_id: profile!.organization_id,
      nome,
      empresa,
      nif,
      telefone,
      email,
    })
    .select()
    .single();

  if (error || !cliente) {
    throw new Error(error?.message || "Não foi possível criar o cliente.");
  }

  if (endereco) {
    await supabase.from("client_addresses").insert({
      organization_id: profile!.organization_id,
      client_id: cliente.id,
      label: "Principal",
      endereco,
    });
  }

  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${cliente.id}`);
}
