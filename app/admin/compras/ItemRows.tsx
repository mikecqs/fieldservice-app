"use client";

import { useState } from "react";

export function ItemRows() {
  const [rows, setRows] = useState([0]);

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-slate-600">Itens a comprar</span>
      {rows.map((key) => (
        <div key={key} className="flex gap-2">
          <input
            name="item_nome"
            placeholder="Material"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="item_qtd"
            type="number"
            step="0.01"
            defaultValue="1"
            className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows(rows.filter((r) => r !== key))}
              className="rounded-md border border-slate-300 px-2 text-xs text-slate-500 hover:bg-slate-50"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, Date.now()])}
        className="text-xs text-indigo-700 hover:underline"
      >
        + adicionar item
      </button>
    </div>
  );
}
