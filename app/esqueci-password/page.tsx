"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NexiaMark } from "@/components/NexiaMark";

export default function EsqueciPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    setAEnviar(true);
    // Por segurança nunca revelamos se o email existe ou não — a mensagem é
    // sempre a mesma independentemente do resultado (só um erro de rede
    // genuíno passa despercebido ao utilizador aqui, o que é aceitável).
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-password`,
    });
    setAEnviar(false);
    setEnviado(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <NexiaMark size={36} />
          <div>
            <div className="text-sm font-bold leading-tight text-white">nexIA</div>
            <div className="text-xs leading-tight text-neutral-400">Recuperar password</div>
          </div>
        </div>

        {enviado ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-200">
              Se existir uma conta ativa associada a este email, receberá instruções para redefinir a password.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-md bg-white px-4 py-2 text-center text-sm font-medium text-neutral-950 hover:bg-neutral-200"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="mb-1 text-sm text-neutral-400">
              Indica o teu email e enviamos-te um link seguro para definires uma nova password.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                onKeyDown={(e) => e.key === "Enter" && email && enviar()}
              />
            </label>

            <button
              onClick={enviar}
              disabled={aEnviar || !email}
              className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-40"
            >
              {aEnviar ? "A enviar…" : "Enviar instruções"}
            </button>

            <Link href="/login" className="block text-center text-xs text-neutral-400 underline">
              Voltar ao login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
