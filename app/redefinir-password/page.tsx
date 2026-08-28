"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NexiaMark } from "@/components/NexiaMark";

export default function RedefinirPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [invalido, setInvalido] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    // O link do email traz a sessão de recuperação embutida no URL (hash ou
    // ?code=) — o próprio cliente Supabase trata disso ao inicializar
    // (detectSessionInUrl). Só precisamos de confirmar que ficou uma sessão
    // válida antes de mostrar o formulário de nova password.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPronto(true);
      } else {
        setInvalido(true);
      }
    });
  }, [supabase]);

  const guardar = async () => {
    setErro(null);
    if (password.length < 6) {
      setErro("A password deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setErro("As passwords não coincidem.");
      return;
    }
    setAGuardar(true);
    const { error } = await supabase.auth.updateUser({ password });
    setAGuardar(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSucesso(true);
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 1500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <NexiaMark size={36} />
          <div>
            <div className="text-sm font-bold leading-tight text-white">nexIA</div>
            <div className="text-xs leading-tight text-neutral-400">Nova password</div>
          </div>
        </div>

        {invalido && (
          <p className="text-sm text-red-400">
            Este link é inválido ou já expirou. Pede um novo em "Esqueceu-se da password?" no login.
          </p>
        )}

        {!invalido && !pronto && <p className="text-sm text-neutral-400">A validar o link…</p>}

        {pronto && sucesso && (
          <p className="text-sm font-medium text-emerald-400">
            Password redefinida com sucesso. A voltar ao login…
          </p>
        )}

        {pronto && !sucesso && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Nova password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">Confirmar nova password</span>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                onKeyDown={(e) => e.key === "Enter" && guardar()}
              />
            </label>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <button
              onClick={guardar}
              disabled={aGuardar || !password || !confirmar}
              className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-40"
            >
              {aGuardar ? "A guardar…" : "Definir nova password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
