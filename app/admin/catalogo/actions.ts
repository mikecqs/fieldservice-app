"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import * as XLSX from "xlsx";

function encontrarColuna(headers: string[], candidatos: string[]) {
  return headers.findIndex((h) => candidatos.some((c) => h.toLowerCase().includes(c)));
}

// Import de catálogo (ex: export Wintouch) — aceita qualquer Excel desde que
// tenha colunas reconhecíveis como referência/descrição/preço de venda,
// nessa ordem de flexibilidade de nomes. Reimportar o mesmo ficheiro
// atualiza os itens existentes (referência é única por empresa) em vez de
// duplicar.
export async function importarCatalogo(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = createClient();
  const file = formData.get("ficheiro") as File | null;
  if (!file || file.size === 0) throw new Error("Escolhe um ficheiro Excel (.xlsx).");

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const linhas: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (linhas.length < 2) throw new Error("Ficheiro vazio ou sem linhas de dados.");

  const headers = (linhas[0] as any[]).map((h) => String(h ?? "").trim());
  const idxRef = encontrarColuna(headers, ["referê", "referen", "ref."]);
  const idxDesc = encontrarColuna(headers, ["descri"]);
  const idxPreco = encontrarColuna(headers, ["preço", "preco", "venda", "pvp"]);

  if (idxRef === -1 || idxDesc === -1 || idxPreco === -1) {
    throw new Error('Não encontrei as colunas "Referência", "Descrição" e "Preço de venda" no ficheiro.');
  }

  const items = linhas
    .slice(1)
    .filter((l) => l[idxRef] != null && String(l[idxRef]).trim() !== "")
    .map((l) => ({
      organization_id: organizationId,
      referencia: String(l[idxRef]).trim(),
      descricao: String(l[idxDesc] ?? "").trim(),
      preco_venda: Number(String(l[idxPreco] ?? "0").replace(",", ".")) || 0,
    }));

  if (items.length === 0) throw new Error("Nenhuma linha válida encontrada no ficheiro.");

  const { error } = await supabase.from("catalog_items").upsert(items, { onConflict: "organization_id,referencia" });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalogo");
}

export async function removerItemCatalogo(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase.from("catalog_items").delete().eq("id", id);
  revalidatePath("/admin/catalogo");
}
