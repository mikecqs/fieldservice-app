"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { iniciarServico, concluirVisita } from "../../actions";

const ESTADO_LABEL: Record<string, [string, string]> = {
  agendado: ["Agendado", "bg-indigo-100 text-indigo-800"],
  em_curso: ["Em curso", "bg-amber-100 text-amber-800"],
  concluido: ["Concluído", "bg-emerald-100 text-emerald-800"],
  nova_visita: ["Nova visita", "bg-orange-100 text-orange-800"],
  nao_realizado: ["Não realizado", "bg-red-100 text-red-700"],
};

export function ServicoDetalheClient({
  servico,
  materiaisPrevistos,
  visitaAbertaId,
}: {
  servico: any;
  materiaisPrevistos: { nome: string; qtd: number }[];
  visitaAbertaId: string | null;
}) {
  const router = useRouter();
  const [aFinalizar, setAFinalizar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [resultado, setResultado] = useState<"concluido" | "nova_visita" | "nao_realizado">("concluido");
  const [trabalho, setTrabalho] = useState("");
  const [materiaisTxt, setMateriaisTxt] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [label, cls] = ESTADO_LABEL[servico.estado] ?? [servico.estado, "bg-slate-100 text-slate-700"];

  const iniciar = async () => {
    setAGuardar(true);
    try {
      await iniciarServico(servico.id);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAGuardar(false);
    }
  };

  const submeter = async () => {
    if (!visitaAbertaId) return;
    if (resultado === "concluido" && !trabalho.trim()) {
      setErro("Descreve o trabalho realizado antes de concluir.");
      return;
    }
    setAGuardar(true);
    setErro(null);
    try {
      const materiais = materiaisTxt
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((nome) => ({ nome, qtd: 1 }));
      await concluirVisita({
        visitId: visitaAbertaId,
        serviceId: servico.id,
        resultado,
        trabalhoRealizado: trabalho,
        materiais,
        fotos: [],
      });
      router.push("/tecnico");
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <div className="px-4 py-4">
      <Link href="/tecnico" className="mb-3 inline-block text-sm text-slate-500">
        ← Agenda
      </Link>

      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{servico.tipo}</span>
      </div>

      <h1 className="text-xl font-bold text-slate-900">{servico.clients_technician_view?.nome}</h1>
      <p className="mt-1 text-sm text-slate-500">{servico.client_addresses_technician_view?.endereco}</p>
      <p className="text-sm text-slate-500">{servico.clients_technician_view?.telefone}</p>

      <div className="mt-4 rounded-lg bg-white p-3 shadow-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Descrição</div>
        <p className="text-sm text-slate-700">{servico.descricao}</p>
      </div>

      {servico.notas && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{servico.notas}</div>
      )}

      {materiaisPrevistos.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Materiais previstos</div>
          <ul className="list-disc pl-5 text-sm text-slate-600">
            {materiaisPrevistos.map((m, i) => (
              <li key={i}>
                {m.nome} × {m.qtd}
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      <div className="mt-6">
        {(servico.estado === "agendado" || servico.estado === "nova_visita") && !aFinalizar && (
          <button
            onClick={iniciar}
            disabled={aGuardar}
            className="w-full rounded-md bg-indigo-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {aGuardar ? "A iniciar…" : servico.estado === "nova_visita" ? "Iniciar nova visita" : "Iniciar serviço"}
          </button>
        )}

        {servico.estado === "em_curso" && !aFinalizar && (
          <button
            onClick={() => setAFinalizar(true)}
            className="w-full rounded-md bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-600"
          >
            Terminar serviço
          </button>
        )}

        {aFinalizar && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">Resultado</div>
              <div className="space-y-2">
                {[
                  ["concluido", "Serviço concluído"],
                  ["nova_visita", "Precisa de nova visita"],
                  ["nao_realizado", "Não foi possível realizar"],
                ].map(([val, lbl]) => (
                  <label
                    key={val}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                      resultado === val ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resultado"
                      checked={resultado === val}
                      onChange={() => setResultado(val as any)}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {resultado === "concluido" ? "Trabalho realizado (obrigatório)" : "Notas (opcional)"}
              </span>
              <textarea
                rows={3}
                value={trabalho}
                onChange={(e) => setTrabalho(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Descreve o que foi feito…"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Materiais utilizados (separados por vírgula, opcional)
              </span>
              <input
                value={materiaisTxt}
                onChange={(e) => setMateriaisTxt(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="ex: Disjuntor 20A, Fita isoladora"
              />
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setAFinalizar(false)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Voltar
              </button>
              <button
                onClick={submeter}
                disabled={aGuardar}
                className="flex-1 rounded-md bg-indigo-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {aGuardar ? "A guardar…" : "Confirmar"}
              </button>
            </div>
          </div>
        )}

        {["concluido", "nao_realizado"].includes(servico.estado) && !aFinalizar && (
          <div className="rounded-lg bg-white p-3 text-sm text-slate-500 shadow-sm">
            Este serviço já foi encerrado. Fala com o administrador para reabrir se for necessário.
          </div>
        )}
      </div>
    </div>
  );
}
