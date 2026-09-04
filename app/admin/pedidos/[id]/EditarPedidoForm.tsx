"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editarPedido } from "../actions";

type Morada = { id: string; label: string; endereco: string };

// Único caminho de edição de um Pedido já criado — só descrição e morada
// (nunca tipo/origem/cliente, ver comentário em editarPedido). A morada só
// pode ser trocada por outra já associada ao cliente (nunca texto livre),
// por isso é sempre um <select>, nunca um <input>. Cada edição fica no
// histórico (request_events), mostrado logo acima por
// PedidoDetalheConteudo — não repetido aqui.
export function EditarPedidoForm({
  pedidoId,
  descricaoAtual,
  addressIdAtual,
  moradas,
}: {
  pedidoId: string;
  descricaoAtual: string;
  addressIdAtual: string;
  moradas: Morada[];
}) {
  const router = useRouter();
  const [aEditar, setAEditar] = useState(false);
  const [descricao, setDescricao] = useState(descricaoAtual);
  const [addressId, setAddressId] = useState(addressIdAtual);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aEditar) {
    return (
      <button
        type="button"
        onClick={() => setAEditar(true)}
        className="text-xs font-medium text-neutral-400 underline hover:text-neutral-200"
      >
        Editar descrição/morada
      </button>
    );
  }

  async function guardar(formData: FormData) {
    setErro(null);
    setAGuardar(true);
    try {
      await editarPedido(formData);
      setAEditar(false);
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível guardar as alterações.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <form action={guardar} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <input type="hidden" name="id" value={pedidoId} />
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-neutral-400">Descrição</span>
        <textarea
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-neutral-400">Morada</span>
        <select
          name="address_id"
          value={addressId}
          onChange={(e) => setAddressId(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          {moradas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}: {m.endereco}
            </option>
          ))}
        </select>
      </label>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAEditar(false);
            setDescricao(descricaoAtual);
            setAddressId(addressIdAtual);
            setErro(null);
          }}
          className="flex-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={aGuardar}
          className="flex-1 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 disabled:opacity-50"
        >
          {aGuardar ? "A guardar…" : "Guardar alterações"}
        </button>
      </div>
    </form>
  );
}
