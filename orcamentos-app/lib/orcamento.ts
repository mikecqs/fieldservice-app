// Única função que calcula subtotal/IVA/total de um orçamento — usada na
// lista, no detalhe e no PDF, para nunca haver duas contas diferentes do
// mesmo orçamento.
export function calcularOrcamento(
  items: { quantidade: number | string; valor_unitario: number | string }[],
  ivaPercent: number | string
) {
  const subtotal = items.reduce(
    (acc, item) => acc + Number(item.quantidade) * Number(item.valor_unitario),
    0
  );
  const ivaValor = subtotal * (Number(ivaPercent) / 100);
  const total = subtotal + ivaValor;
  return { subtotal, ivaValor, total };
}
