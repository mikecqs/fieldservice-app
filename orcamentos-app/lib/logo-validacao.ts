// Extraído de app/(app)/empresa/actions.ts para ser testável em isolado
// (ficheiros "use server" só podem exportar funções async — esta é
// síncrona e pura de propósito, para dar para testar sem tocar em
// Supabase/rede nenhuma).

export const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024; // 2MB — mais que suficiente para um logotipo

// Assinaturas reais dos ficheiros (magic bytes), não o `file.type` que o
// browser declara — esse é só o que o próprio ficheiro AFIRMA ser,
// facilmente forjável (renomear/alterar um ficheiro qualquer para
// Content-Type: image/png não o torna um PNG de verdade).
export function detetarTipoImagem(bytes: Uint8Array): "png" | "jpg" | null {
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((b, i) => bytes[i] === b)) return "png";

  const JPEG = [0xff, 0xd8, 0xff];
  if (JPEG.every((b, i) => bytes[i] === b)) return "jpg";

  return null;
}
