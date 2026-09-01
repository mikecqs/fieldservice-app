"use client";

import { useState } from "react";
import { agendarVisitaPreviaDoOrcamento } from "../actions";

// Botão próprio só para ter estado de submissão (desabilitar durante o
// pedido) — não intercepta o submit nem chama a Server Action à mão: o
// <form> continua nativo, porque agendarVisitaPreviaDoOrcamento faz
// redirect() (para a visita já existente, ou para a Agenda depois de
// criar), e um wrapper com try/catch à volta da chamada apanharia esse
// redirect como se fosse um erro comum. A proteção real contra duplicados
// continua sempre no servidor (verificação de visita existente antes de
// criar); isto é só para o utilizador não conseguir clicar duas vezes
// enquanto a primeira submissão ainda está em curso.
export function AgendarVisitaPreviaButton({ orcamentoId }: { orcamentoId: string }) {
  const [submetendo, setSubmetendo] = useState(false);

  return (
    <form action={agendarVisitaPreviaDoOrcamento} onSubmit={() => setSubmetendo(true)}>
      <input type="hidden" name="id" value={orcamentoId} />
      <button
        type="submit"
        disabled={submetendo}
        className="rounded-md border border-sky-500/30 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submetendo ? "A agendar…" : "Agendar visita prévia"}
      </button>
    </form>
  );
}
