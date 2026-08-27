"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const entrar = async () => {
    setErro(null);
    setAEnviar(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAEnviar(false);
    if (error) {
      setErro("Email ou palavra-passe incorretos.");
      return;
    }
    // Navegação completa (não client-side): a página raiz decide para onde
    // mandar o utilizador consoante a role. Usar router.push+refresh aqui
    // causava "Maximum update depth exceeded" no RedirectBoundary do Next,
    // por conflito com o redirect() do servidor na página seguinte.
    window.location.assign("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-500 font-mono text-sm font-bold text-white">
            FS
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-slate-900">FieldService</div>
            <div className="text-xs leading-tight text-slate-500">Gestão de terreno</div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && entrar()}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Palavra-passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && entrar()}
            />
          </label>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            onClick={entrar}
            disabled={aEnviar || !email || !password}
            className="w-full rounded-md bg-indigo-900 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-40"
          >
            {aEnviar ? "A entrar…" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
