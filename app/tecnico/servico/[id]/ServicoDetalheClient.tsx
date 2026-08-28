"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { iniciarServico, concluirVisita } from "../../actions";

const MAO_OBRA_OPCOES: [string, string][] = [
  ["1h", "1 hora"],
  ["2h", "2 horas"],
  ["3h", "3 horas"],
  ["4h", "4 horas"],
  ["5h", "5 horas"],
  ["6h", "6 horas"],
  ["7h", "7 horas"],
  ["8h", "8 horas"],
  ["dia_completo", "Dia completo"],
  ["2dias", "2 dias completos"],
  ["outro", "Outro"],
];

const ESTADO_LABEL: Record<string, [string, string]> = {
  agendado: ["Agendado", "bg-indigo-100 text-indigo-800"],
  em_curso: ["Em curso", "bg-amber-100 text-amber-800"],
  aguarda_validacao: ["Aguarda validação", "bg-amber-100 text-amber-800"],
  concluido: ["Concluído", "bg-emerald-100 text-emerald-800"],
  correcao_necessaria: ["Correção necessária", "bg-red-100 text-red-800"],
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
  const [maoObraTipo, setMaoObraTipo] = useState("");
  const [maoObraDetalhe, setMaoObraDetalhe] = useState("");
  const [agendouNovaData, setAgendouNovaData] = useState<"sim" | "nao" | null>(null);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");
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

    if (resultado === "concluido") {
      if (!trabalho.trim()) {
        setErro("Descreve o trabalho realizado antes de concluir.");
        return;
      }
      if (!maoObraTipo) {
        setErro("Seleciona a mão de obra antes de concluir.");
        return;
      }
      if (maoObraTipo === "outro" && !maoObraDetalhe.trim()) {
        setErro("Descreve a mão de obra em \"Outro\".");
        return;
      }
    } else {
      if (!trabalho.trim()) {
        setErro("As notas são obrigatórias.");
        return;
      }
      if (resultado === "nova_visita") {
        if (!agendouNovaData) {
          setErro("Indica se já foi agendada uma nova data com o cliente.");
          return;
        }
        if (agendouNovaData === "sim" && (!novaData || !novaHora)) {
          setErro("Indica a data e hora combinadas com o cliente.");
          return;
        }
      }
    }

    setAGuardar(true);
    setErro(null);
    try {
      const materiais =
        resultado === "concluido"
          ? materiaisTxt
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((nome) => ({ nome, qtd: 1 }))
          : [];
      await concluirVisita({
        visitId: visitaAbertaId,
        serviceId: servico.id,
        resultado,
        trabalhoRealizado: trabalho,
        materiais,
        fotos: [],
        maoObraTipo: resultado === "concluido" ? maoObraTipo : null,
        maoObraDetalhe: resultado === "concluido" && maoObraTipo === "outro" ? maoObraDetalhe : null,
        novaDataAgendada: resultado === "nova_visita" && agendouNovaData === "sim" ? novaData : null,
        novaHoraAgendada: resultado === "nova_visita" && agendouNovaData === "sim" ? novaHora : null,
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

      {servico.estado === "correcao_necessaria" && servico.motivo_correcao && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <span className="font-semibold">⚠️ O Admin pediu uma correção:</span> {servico.motivo_correcao}
        </div>
      )}

      <h1 className="text-xl font-bold text-slate-900">{servico.cliente_nome}</h1>
      {servico.detalhes_visiveis ? (
        <>
          {servico.morada && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(servico.morada)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-sm text-indigo-700 underline"
            >
              📍 {servico.morada}
            </a>
          )}
          {servico.cliente_telefone && <p className="mt-1 text-sm text-slate-500">{servico.cliente_telefone}</p>}
          {servico.cliente_telefone && (
            <a
              href={`tel:${servico.cliente_telefone}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              📞 Chamar cliente
            </a>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm font-medium text-amber-700">
          🔒 Morada, contacto e descrição ficam visíveis quando este for o próximo serviço.
        </p>
      )}

      {servico.detalhes_visiveis && (
        <div className="mt-4 rounded-lg bg-white p-3 shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Descrição</div>
          <p className="text-sm text-slate-700">{servico.descricao}</p>
        </div>
      )}

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
        {!servico.desbloqueado &&
          ["agendado", "nova_visita", "correcao_necessaria"].includes(servico.estado) &&
          !aFinalizar && (
            <div className="rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-500">
              🔒 Fecha o serviço anterior para poderes iniciar este.
            </div>
          )}

        {servico.desbloqueado &&
          ["agendado", "nova_visita", "correcao_necessaria"].includes(servico.estado) &&
          !aFinalizar && (
            <button
              onClick={iniciar}
              disabled={aGuardar}
              className="w-full rounded-md bg-indigo-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {aGuardar
                ? "A iniciar…"
                : servico.estado === "nova_visita"
                ? "Iniciar nova visita"
                : servico.estado === "correcao_necessaria"
                ? "Corrigir e reabrir"
                : "Iniciar serviço"}
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
                      onChange={() => {
                        setResultado(val as any);
                        setMateriaisTxt("");
                        setMaoObraTipo("");
                        setMaoObraDetalhe("");
                        setAgendouNovaData(null);
                        setNovaData("");
                        setNovaHora("");
                        setErro(null);
                      }}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {resultado === "concluido" ? "Trabalho realizado (obrigatório)" : "Notas (obrigatório)"}
              </span>
              <textarea
                rows={3}
                value={trabalho}
                onChange={(e) => setTrabalho(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Descreve o que foi feito…"
              />
            </label>

            {resultado === "concluido" && (
              <>
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

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Mão de obra (obrigatório)</span>
                  <select
                    value={maoObraTipo}
                    onChange={(e) => setMaoObraTipo(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Seleciona…</option>
                    {MAO_OBRA_OPCOES.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </label>

                {maoObraTipo === "outro" && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Descreve a mão de obra</span>
                    <input
                      value={maoObraDetalhe}
                      onChange={(e) => setMaoObraDetalhe(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="ex: 3 técnicos, meio-dia cada"
                    />
                  </label>
                )}
              </>
            )}

            {resultado === "nova_visita" && (
              <div>
                <span className="mb-2 block text-xs font-medium text-slate-600">
                  Agendada nova data com o cliente?
                </span>
                <div className="flex gap-2">
                  {(["sim", "nao"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAgendouNovaData(v)}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                        agendouNovaData === v
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                          : "border-slate-300 text-slate-700"
                      }`}
                    >
                      {v === "sim" ? "Sim" : "Não"}
                    </button>
                  ))}
                </div>
                {agendouNovaData === "sim" && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="date"
                      value={novaData}
                      onChange={(e) => setNovaData(e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="time"
                      value={novaHora}
                      onChange={(e) => setNovaHora(e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
                {agendouNovaData === "nao" && (
                  <p className="mt-2 text-xs text-slate-500">
                    O Admin vai ver este serviço como pendente de agendamento.
                  </p>
                )}
              </div>
            )}

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

        {servico.estado === "aguarda_validacao" && !aFinalizar && (
          <div className="rounded-lg bg-white p-3 text-sm text-slate-500 shadow-sm">
            Serviço concluído — aguarda validação do Admin antes de seguir para faturação.
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
