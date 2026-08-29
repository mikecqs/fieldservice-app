// Regras do ciclo de vida da Compra — mesmo espírito de
// lib/servico-estado.ts (BLOCO 5) e lib/orcamento-estado.ts (BLOCO 6): uma
// única fonte de verdade por regra, para nunca haver duas versões
// diferentes entre servidor e UI.

// Mesmas transições que a UI já oferecia em app/admin/compras/page.tsx
// (PROXIMO_ESTADO) — 'parcial' e 'cancelada' não têm nenhum caminho de
// entrada hoje (ver relatório final: fica como decisão a aprovar, não
// inventado agora).
const ORIGENS_PERMITIDAS_POR_DESTINO: Record<string, readonly string[]> = {
  encomendada: ["por_encomendar"],
  recebida: ["encomendada", "parcial"],
};

export function podeAvancarCompraParaEstado(compra: { estado: string }, destino: string): boolean {
  const origens = ORIGENS_PERMITIDAS_POR_DESTINO[destino];
  if (!origens) return false;
  return origens.includes(compra.estado);
}
