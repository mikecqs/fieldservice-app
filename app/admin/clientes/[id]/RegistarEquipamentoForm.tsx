"use client";

import { useRef, useState } from "react";
import { criarEquipamento } from "./actions";

type Morada = { id: string; label: string; endereco: string };

// Mesmo bug dos outros formulários sem redirect: sem isto, o "+ Registar
// equipamento" ficava com todos os campos (incluindo a fotografia
// escolhida) depois de gravar com sucesso.
export function RegistarEquipamentoForm({ clientId, moradas }: { clientId: string; moradas: Morada[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  async function submeter(formData: FormData) {
    setErro(null);
    setAGuardar(true);
    try {
      await criarEquipamento(formData);
      formRef.current?.reset();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível registar o equipamento.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <form ref={formRef} action={submeter} encType="multipart/form-data" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {erro && <p className="col-span-2 rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-400">{erro}</p>}
      <input type="hidden" name="client_id" value={clientId} />
      <input name="equipamento" placeholder="Equipamento (ex: Câmara IP, Central de alarme)" required className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      {moradas.length > 0 && (
        <select name="address_id" className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm">
          <option value="">Localização — sem especificar</option>
          {moradas.map((a) => (
            <option key={a.id} value={a.id}>{a.label}: {a.endereco}</option>
          ))}
        </select>
      )}
      <input name="marca" placeholder="Marca" className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      <input name="modelo" placeholder="Modelo" className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      <input name="numero_serie" placeholder="Número de série / referência" className="rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Data de instalação</span>
        <input name="data_instalacao" type="date" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>
      <textarea name="notas" placeholder="Notas (opcional)" rows={2} className="col-span-2 rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      <label className="col-span-2 block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Fotografia (opcional)</span>
        <input name="foto" type="file" accept="image/*" className="w-full text-sm" />
      </label>
      <button
        type="submit"
        disabled={aGuardar}
        className="col-span-2 mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
      >
        {aGuardar ? "A registar…" : "Registar equipamento"}
      </button>
    </form>
  );
}
