// Helvetica (StandardFonts) usa a codificação WinAnsi (Windows-1252) — que
// cobre Latin-1 (0x00–0xFF) MAIS um punhado de símbolos "extra" nos bytes
// 0x80–0x9F, entre eles o Euro (€, U+20AC). Um filtro ingénuo que só deixa
// passar codePoint <= 0xFF (como este ficheiro tinha antes) apanha essa
// gente toda como "fora do intervalo" e troca por "?" — foi exatamente
// isso que fez o € aparecer errado nos PDFs. Esta lista é a tabela real de
// exceções da WinAnsiEncoding, não uma aproximação.
const WINANSI_EXTRA = new Set([
  0x20ac, // €
  0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013,
  0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

// Qualquer coisa fora disto (emoji, CJK, símbolos raros colados de outra
// fonte) faz o pdf-lib rebentar a meio da geração — substitui por "?" em
// vez de deixar cair o pedido inteiro com 500.
export function textoSeguroPdf(texto: string | null | undefined): string {
  if (!texto) return "";
  return Array.from(texto)
    .map((ch) => {
      const codigo = ch.codePointAt(0)!;
      return codigo <= 0xff || WINANSI_EXTRA.has(codigo) ? ch : "?";
    })
    .join("");
}
