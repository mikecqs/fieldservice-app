"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";

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
