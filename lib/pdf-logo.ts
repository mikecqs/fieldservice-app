import type { PDFDocument, PDFImage } from "pdf-lib";

const FORMATOS_EMBUTIVEIS_LOGO = new Set(["png", "jpg", "jpeg"]);

// Baixa e embute o logotipo da empresa (bucket "logos", Configurações) num
// PDF já aberto — partilhado entre o fecho de serviço (lib/pdf-fecho.ts) e
// o orçamento (app/admin/orcamentos/[id]/pdf/route.ts), nunca duas versões
// da mesma lógica. Nunca lança exceção: sem logotipo configurado, ficheiro
// em falta no Storage, ou formato não suportado (pdf-lib só embute png/jpg,
// nunca webp/heic — por isso o bucket já só aceita esses dois na origem),
// devolve null e quem chama cai sempre no quadrado "nX" genérico de antes.
export async function embutirLogo(pdf: PDFDocument, supabase: any, logoPath: string | null | undefined): Promise<PDFImage | null> {
  if (!logoPath) return null;
  const ext = (logoPath.split(".").pop() || "").toLowerCase();
  if (!FORMATOS_EMBUTIVEIS_LOGO.has(ext)) return null;
  try {
    const { data: blob, error } = await supabase.storage.from("logos").download(logoPath);
    if (error || !blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return ext === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}
