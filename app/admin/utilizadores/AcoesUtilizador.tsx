"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { desativarUtilizador, reativarUtilizador, resetPasswordUtilizador } from "./actions";

// resetPasswordUtilizador/desativarUtilizador/reativarUtilizador não fazem
// redirect nem revalidatePath — chamá-las via <form action={...}> direto
// (como antes) faz um erro esperado do Supabase (ex: "email rate limit
// exceeded", confirmado em produção) rebentar toda a página, indo parar ao
// error boundary genérico (app/admin/error.tsx). Mesmo padrão de
// NovoUtilizadorForm.tsx/ReativarServicoForm.tsx: chamar a action
// manualmente e mostrar o erro inline.
export function AcoesUtilizador({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [aGuardar, setAGuardar] = useState<"reset" | "estado" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function reporPassword() {
    setErro(null);
    setSucesso(null);
    setAGuardar("reset");
    const formData = new FormData();
    formData.set("id", id);
    try {
      await resetPasswordUtilizador(formData);
      setSucesso("Email de reposição de password enviado.");
    } catch (e: any) {
      setErro(e?.message || "Não foi possível repor a password.");
    } finally {
      setAGuardar(null);
    }
  }

  async function alternarEstado() {
    setErro(null);
    setSucesso(null);
    setAGuardar("estado");
    const formData = new FormData();
    formData.set("id", id);
    try {
      await (ativo ? desativarUtilizador : reativarUtilizador)(formData);
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível concluir a ação.");
    } finally {
      setAGuardar(null);
    }
  }

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reporPassword}
          disabled={aGuardar !== null}
          className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
        >
          {aGuardar === "reset" ? "A enviar…" : "Repor password"}
        </button>
        {ativo ? (
          <button
            type="button"
            onClick={alternarEstado}
            disabled={aGuardar !== null}
            className="rounded-md border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {aGuardar === "estado" ? "A desativar…" : "Desativar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={alternarEstado}
            disabled={aGuardar !== null}
            className="rounded-md border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {aGuardar === "estado" ? "A reativar…" : "Reativar"}
          </button>
        )}
      </div>
      {erro && <p className="text-right text-[11px] text-red-400">{erro}</p>}
      {sucesso && <p className="text-right text-[11px] text-emerald-400">{sucesso}</p>}
    </div>
  );
}
