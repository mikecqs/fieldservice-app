"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Nunca redireciona — devolve sempre o cliente criado para quem chamou
// decidir o que fazer a seguir (a página /admin/clientes/novo é um
// componente cliente que, depois de criar o cliente, pergunta "Deseja criar
// um pedido?" antes de navegar para qualquer lado).
export async function criarCliente(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const nome = String(formData.get("nome") || "").trim();
  const empresa = String(formData.get("empresa") || "");
  const nif = String(formData.get("nif") || "");
  const telefone = String(formData.get("telefone") || "").trim();
  const email = String(formData.get("email") || "");
  const endereco = String(formData.get("endereco") || "");

  if (!nome) throw new Error("Nome é obrigatório.");
  if (!telefone) throw new Error("Telefone é obrigatório.");

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
  return cliente;
}

// Versões "rápidas" das duas ações acima, para o passo "criar cliente" /
// "criar morada" dentro do próprio formulário de Novo Pedido (Admin e
// Atendimento) — nunca navegam para outro sítio, só devolvem o registo
// criado para o formulário selecionar automaticamente. organization_id vem
// sempre do perfil autenticado (nunca do formulário) e a RLS (policies
// "admin manages clients"/"atendimento creates clients" e equivalentes para
// client_addresses, em schema.sql) é quem decide de facto se o insert é
// permitido — as duas roles que podem chamar isto (ADMIN/SUPER_ADMIN e
// ATENDIMENTO) já têm essa permissão.
export async function criarClienteRapido(input: { nome: string; telefone?: string; email?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");

  const { data: cliente, error } = await supabase
    .from("clients")
    .insert({
      organization_id: profile!.organization_id,
      nome,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
    })
    .select("id, nome, codigo")
    .single();

  if (error || !cliente) throw new Error(error?.message || "Não foi possível criar o cliente.");

  revalidatePath("/admin/clientes");
  return cliente;
}

export async function criarMoradaRapida(input: { client_id: string; endereco: string; label?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const endereco = input.endereco.trim();
  const client_id = input.client_id;
  if (!endereco || !client_id) throw new Error("Morada é obrigatória.");

  const { data: morada, error } = await supabase
    .from("client_addresses")
    .insert({
      organization_id: profile!.organization_id,
      client_id,
      label: input.label?.trim() || "Principal",
      endereco,
    })
    .select("id, label, endereco")
    .single();

  if (error || !morada) throw new Error(error?.message || "Não foi possível criar a morada.");

  revalidatePath(`/admin/clientes/${client_id}`);
  return morada;
}
