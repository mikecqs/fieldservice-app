"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth";
import ExcelJS from "exceljs";

function encontrarColuna(headers: string[], candidatos: string[]) {
  return headers.findIndex((h) => candidatos.some((c) => h.toLowerCase().includes(c)));
}

// Auditoria de segurança (Finding 5) — este era o único ponto do projeto
// onde se fazia parsing de um ficheiro Excel ENVIADO por um utilizador (as
// exportações de Financeiro/Relatórios só escrevem, nunca leem, por isso
// continuam com xlsx@0.18.5). A biblioteca "xlsx" tem 2 CVEs conhecidos
// (Prototype Pollution, ReDoS) só no código de leitura, e a SheetJS parou
// de publicar correções no npm depois da 0.18.5 (só via CDN próprio,
// inacessível a partir desta rede) — troca para "exceljs" (mantida
// ativamente, sem CVEs conhecidos na leitura), só nesta função.
//
// exceljs nunca calcula fórmulas (só lê o texto da fórmula e, quando
// existe, o último resultado que o Excel guardou em cache — exatamente
// como "xlsx" já fazia) — nunca executa nada do ficheiro além de ler
// células.
function valorCelula(v: ExcelJS.CellValue): unknown {
  if (v == null || v instanceof Date) return v;
  if (typeof v === "object") {
    const obj = v as any;
    if (Array.isArray(obj.richText)) return obj.richText.map((t: any) => t.text ?? "").join("");
    if ("result" in obj) return obj.result; // fórmula: só o resultado em cache, nunca a fórmula em si
    if ("text" in obj) return obj.text; // hyperlink
    return null;
  }
  return v;
}

// Import de catálogo (ex: export Wintouch) — aceita qualquer Excel desde que
// tenha colunas reconhecíveis como referência/descrição/preço de venda,
// nessa ordem de flexibilidade de nomes. Reimportar o mesmo ficheiro
// atualiza os itens existentes (referência é única por empresa) em vez de
// duplicar.
export async function importarCatalogo(formData: FormData) {
  const organizationId = await getOrgId();
  const supabase = await createClient();
  const file = formData.get("ficheiro") as File | null;
  if (!file || file.size === 0) throw new Error("Escolhe um ficheiro Excel (.xlsx).");

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new Error("Não foi possível ler o ficheiro — confirma que é um Excel (.xlsx) válido.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Ficheiro vazio ou sem folhas.");

  const linhas: unknown[][] = [];
  sheet.eachRow((row) => {
    // row.values é 1-indexado (índice 0 vem sempre vazio) — normaliza para
    // um array 0-indexado, mesmo formato que XLSX.utils.sheet_to_json(sheet,
    // { header: 1 }) já devolvia, para o resto da função nunca precisar de
    // mudar.
    linhas.push((row.values as ExcelJS.CellValue[]).slice(1).map(valorCelula));
  });
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

  // Nunca aceitar preços negativos do ficheiro importado — em vez de
  // silenciosamente zerar ou ignorar a linha (que esconderia um erro no
  // ficheiro de origem), rejeita a importação toda com uma mensagem clara.
  if (items.some((it) => it.preco_venda < 0)) {
    throw new Error("O ficheiro tem preços negativos — corrige o ficheiro e importa novamente.");
  }

  const { error } = await supabase.from("catalog_items").upsert(items, { onConflict: "organization_id,referencia" });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalogo");
}

export async function removerItemCatalogo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase.from("catalog_items").delete().eq("id", id);
  revalidatePath("/admin/catalogo");
}
