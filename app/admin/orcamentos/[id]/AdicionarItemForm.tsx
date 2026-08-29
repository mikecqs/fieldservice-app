"use client";

import { useRef, useState } from "react";
import { adicionarItem } from "../actions";

type CatalogItem = { id: string; referencia: string; descricao: string; preco_venda: number };

export function AdicionarItemForm({ budgetId, catalogo }: { budgetId: string; catalogo: CatalogItem[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState("mao_obra");
  const [descricao, setDescricao] = useState("");
  const [valorUnit, setValorUnit] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function aplicarCatalogo(id: string) {
    const item = catalogo.find((c) => c.id === id);
    if (!item) return;
    setDescricao(`${item.referencia} — ${item.descricao}`);
    setValorUnit(String(item.preco_venda));
    setTipo("materiais");
  }

  // Os campos "descrição" e "€ unit." são controlados (para o catálogo os
  // poder preencher), por isso um <form action={adicionarItem}> sozinho
  // nunca os limpava depois de gravar — o Next não desmonta o formulário
  // (sem redirect) e o state React continua com o que lá estava.
  async function submeter(formData: FormData) {
    setErro(null);
    try {
      await adicionarItem(formData);
      setTipo("mao_obra");
      setDescricao("");
      setValorUnit("");
      formRef.current?.reset();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível adicionar a linha.");
    }
  }

  return (
    <form ref={formRef} action={submeter} className="mt-4 space-y-2 border-t border-neutral-800 pt-4">
      {erro && <p className="rounded-md bg-red-500/15 px-2 py-1.5 text-xs text-red-400">{erro}</p>}
      <input type="hidden" name="budget_id" value={budgetId} />

      {catalogo.length > 0 && (
        <select
          onChange={(e) => aplicarCatalogo(e.target.value)}
          defaultValue=""
          className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
        >
          <option value="">Escolher do catálogo (opcional)…</option>
          {catalogo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.referencia} — {c.descricao} · {c.preco_venda.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs">
          <option value="materiais">Materiais</option>
          <option value="mao_obra">Mão de obra</option>
          <option value="deslocacao">Deslocação</option>
          <option value="outros">Outros</option>
        </select>
        <input
          name="descricao"
          placeholder="Descrição"
          required
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="col-span-2 rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
        />
        <input name="qtd" type="number" step="0.01" defaultValue="1" placeholder="Qtd" className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs" />
        <input
          name="valor_unit"
          type="number"
          step="0.01"
          placeholder="€ unit."
          value={valorUnit}
          onChange={(e) => setValorUnit(e.target.value)}
          className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
        />
        <button className="col-span-2 mt-1 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 sm:col-span-5">
          Adicionar linha
        </button>
      </div>
    </form>
  );
}
