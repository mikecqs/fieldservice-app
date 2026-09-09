"use client";

import { useState } from "react";
import { podeEditarItensOrcamento } from "@/lib/orcamento-estado";
import { adicionarItem, removerItem } from "../actions";

type Item = { id: string; descricao: string; quantidade: number; valor_unitario: number };

export default function ItensEditor({
  budgetId,
  estado,
  items,
  ivaPercent,
  totais,
}: {
  budgetId: string;
  estado: string;
  items: Item[];
  ivaPercent: number;
  totais: { subtotal: number; ivaValor: number; total: number };
}) {
  const editavel = podeEditarItensOrcamento({ estado });
  const [erro, setErro] = useState<string | null>(null);

  async function onAdicionar(formData: FormData) {
    setErro(null);
    const resultado = await adicionarItem(budgetId, formData);
    if (resultado?.erro) setErro(resultado.erro);
  }

  async function onRemover(itemId: string) {
    setErro(null);
    const resultado = await removerItem(budgetId, itemId);
    if (resultado?.erro) setErro(resultado.erro);
  }

  return (
    <section className="rounded-2xl border border-edge bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Itens</h2>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-edge text-left text-muted-foreground">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Qtd</th>
            <th className="py-2 text-right">Valor unit.</th>
            <th className="py-2 text-right">Total</th>
            {editavel && <th className="py-2" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-edge/60">
              <td className="py-2 text-neutral-200">{item.descricao}</td>
              <td className="py-2 text-right text-neutral-200">{item.quantidade}</td>
              <td className="py-2 text-right text-neutral-200">{item.valor_unitario.toFixed(2)} €</td>
              <td className="py-2 text-right text-neutral-200">
                {(item.quantidade * item.valor_unitario).toFixed(2)} €
              </td>
              {editavel && (
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRemover(item.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remover
                  </button>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={editavel ? 5 : 4} className="py-4 text-center text-muted-foreground">
                Ainda não há itens.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editavel && (
        <form action={onAdicionar} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px_120px_auto]">
          <input
            name="descricao"
            placeholder="Descrição"
            required
            className="rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
          />
          <input
            name="quantidade"
            type="number"
            step="0.01"
            defaultValue={1}
            required
            className="rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white focus:border-edge-subtle focus:outline-none"
          />
          <input
            name="valorUnitario"
            type="number"
            step="0.01"
            placeholder="Valor unit. €"
            required
            className="rounded-md border border-edge bg-surface-raised px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-edge-subtle focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-edge-subtle px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
          >
            Adicionar
          </button>
        </form>
      )}

      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}

      <div className="mt-4 flex justify-end">
        <dl className="w-56 space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <dt>Subtotal</dt>
            <dd>{totais.subtotal.toFixed(2)} €</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>IVA ({ivaPercent}%)</dt>
            <dd>{totais.ivaValor.toFixed(2)} €</dd>
          </div>
          <div className="flex justify-between border-t border-edge pt-1 font-semibold text-white">
            <dt>Total</dt>
            <dd>{totais.total.toFixed(2)} €</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
