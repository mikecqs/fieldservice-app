"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import { assertPertenceAOrg, assertMoradaPertenceCliente } from "@/lib/tenant-guard";

export async function criarEquipamento(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const client_id = String(formData.get("client_id") || "");
  const address_id = String(formData.get("address_id") || "") || null;
  const equipamento = String(formData.get("equipamento") || "").trim();
  const marca = String(formData.get("marca") || "").trim() || null;
  const modelo = String(formData.get("modelo") || "").trim() || null;
  const numero_serie = String(formData.get("numero_serie") || "").trim() || null;
  const data_instalacao = String(formData.get("data_instalacao") || "") || null;
  const notas = String(formData.get("notas") || "").trim() || null;
  if (!client_id || !equipamento) return;

  // Finding 1 — client_id/address_id vêm da própria página do cliente
  // (nunca de um formulário genérico), mas nada impede um pedido forjado
  // com ids de outra empresa; a RLS de INSERT em "client_equipment" só
  // valida a organização da PRÓPRIA linha, nunca a do cliente/morada
  // referenciados.
  await assertPertenceAOrg(supabase, "clients", client_id, organizationId, "Cliente não pertence a esta empresa.");
  if (address_id) {
    await assertMoradaPertenceCliente(supabase, address_id, client_id, organizationId, "A morada selecionada não pertence a este cliente.");
  }

  const { data: equip, error } = await supabase
    .from("client_equipment")
    .insert({ organization_id: organizationId, client_id, address_id, equipamento, marca, modelo, numero_serie, data_instalacao, notas })
    .select()
    .single();
  if (error || !equip) throw new Error(error?.message || "Não foi possível criar o equipamento.");

  // Fotografia opcional — guardada sempre sob "{organization_id}/..." porque
  // é isso que a policy de storage verifica (ver schema.sql).
  const foto = formData.get("foto") as File | null;
  if (foto && foto.size > 0) {
    const ext = foto.name.split(".").pop() || "jpg";
    const path = `${organizationId}/${equip.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("equipamentos")
      .upload(path, foto, { upsert: true, contentType: foto.type });
    if (!upErr) {
      await supabase.from("client_equipment").update({ foto_path: path }).eq("id", equip.id);
    }
  }

  revalidatePath(`/admin/clientes/${client_id}`);
}

// Soft delete (auditoria de segurança) — antes apagava a linha E a
// fotografia do Storage de imediato, sem confirmação nem forma de
// recuperar um clique em engano. Agora só marca "eliminado" (mesmo espírito
// de profiles.ativo): desaparece da ficha do cliente (a query em page.tsx
// filtra eliminado=false), mas a fotografia e o registo continuam
// recuperáveis à mão na BD, nunca destruídos por esta ação.
export async function removerEquipamento(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const client_id = String(formData.get("client_id") || "");
  if (!id) return;

  await supabase.from("client_equipment").update({ eliminado: true }).eq("id", id);
  revalidatePath(`/admin/clientes/${client_id}`);
}
