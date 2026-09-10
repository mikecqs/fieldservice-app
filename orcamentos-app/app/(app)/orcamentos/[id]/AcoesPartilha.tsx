"use client";

import { useState } from "react";
import { duplicarOrcamento } from "../actions";

// Número de telemóvel para link wa.me — só dígitos; assume PT (9 dígitos
// sem indicativo) quando o número não já vem com indicativo de país.
function linkWhatsapp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const comIndicativo = digitos.length === 9 ? `351${digitos}` : digitos;
  return `https://wa.me/${comIndicativo}`;
}

export default function AcoesPartilha({
  budgetId,
  numero,
  total,
  clienteNome,
  clienteTelefone,
  clienteEmail,
}: {
  budgetId: string;
  numero: string;
  total: number;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEmail: string | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [aDuplicar, setADuplicar] = useState(false);

  const mensagem = `Olá ${clienteNome}, aqui está o orçamento ${numero}, no valor de ${total.toFixed(2)} €. Vou enviar o PDF a seguir.`;

  async function onDuplicar() {
    setErro(null);
    setADuplicar(true);
    // Em caso de sucesso, duplicarOrcamento() já faz redirect() para o
    // novo orçamento — só chega a atualizar o estado local se falhar.
    const resultado = await duplicarOrcamento(budgetId);
    setADuplicar(false);
    if (resultado?.erro) {
      setErro(resultado.erro);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/orcamentos/${budgetId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-edge-subtle px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
      >
        Ver PDF
      </a>

      {clienteTelefone && (
        <a
          href={`${linkWhatsapp(clienteTelefone)}?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-edge-subtle px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
        >
          WhatsApp
        </a>
      )}

      {clienteEmail && (
        <a
          href={`mailto:${clienteEmail}?subject=${encodeURIComponent(`Orçamento ${numero}`)}&body=${encodeURIComponent(
            `${mensagem}\n\n(Anexe o PDF descarregado antes de enviar — o email não o anexa automaticamente.)`
          )}`}
          className="rounded-md border border-edge-subtle px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised"
        >
          Email
        </a>
      )}

      <button
        type="button"
        onClick={onDuplicar}
        disabled={aDuplicar}
        className="rounded-md border border-edge-subtle px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-surface-raised disabled:opacity-60"
      >
        {aDuplicar ? "A duplicar..." : "Duplicar"}
      </button>

      {erro && <p className="w-full text-sm text-red-400">{erro}</p>}
    </div>
  );
}
