// Auditoria de segurança — Finding 4: a extensão do ficheiro guardado nunca
// deve vir do nome que o próprio ficheiro trazia (file.name) — um upload
// forjado podia chamar-se "qualquer-coisa.jpg" com um `file.type` completamente
// diferente, ou nem ter extensão nenhuma. A única fonte de confiança é o MIME
// type declarado no upload (validado à parte pelo `allowed_mime_types` do
// bucket em storage.buckets — nunca o nome do ficheiro).
//
// Mesma lista em ambos os buckets que aceitam fotos (schema.sql):
// "equipamentos" e "visitas".
const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extensaoPorMime(mime: string): string | null {
  return EXTENSAO_POR_MIME[mime] ?? null;
}
