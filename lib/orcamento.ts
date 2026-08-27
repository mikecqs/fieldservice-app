// Única função que calcula subtotal/IVA/total de um orçamento — usada na
// lista, no detalhe, e ao aceitar (para o valor do serviço criado), para
// nunca haver duas contas diferentes do mesmo orçamento.
export function calcularOrcamento(
  items: { qtd: number | string; valor_unit: number | string }[],
  ivaPercent: number | string
) {
  const subtotal = items.reduce((acc, i) => acc + Number(i.qtd) * Number(i.valor_unit), 0);
  const ivaValor = subtotal * (Number(ivaPercent) / 100);
  const total = subtotal + ivaValor;
  return { subtotal, ivaValor, total };
}
