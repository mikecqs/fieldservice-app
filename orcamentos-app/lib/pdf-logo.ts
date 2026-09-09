import type { PDFDocument, PDFImage } from "pdf-lib";

const FORMATOS_EMBUTIVEIS = new Set(["png", "jpg", "jpeg"]);

// Baixa e embute o logotipo da empresa (bucket privado "logos") num PDF já
// aberto. Nunca lança — sem logo configurado, ficheiro em falta ou formato
// não suportado, devolve null e quem chama cai no quadrado genérico.
// `supabase` aceita tanto o cliente SSR como o admin client — só usa
// `.storage`, presente em ambos.
export async function embutirLogo(
  pdf: PDFDocument,
  supabase: { storage: { from(bucket: string): { download(path: string): Promise<{ data: Blob | null; error: unknown }> } } },
  logoPath: string | null | undefined
): Promise<PDFImage | null> {
  if (!logoPath) return null;
  const ext = (logoPath.split(".").pop() || "").toLowerCase();
  if (!FORMATOS_EMBUTIVEIS.has(ext)) return null;

  try {
    const { data: blob, error } = await supabase.storage.from("logos").download(logoPath);
    if (error || !blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return ext === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}
