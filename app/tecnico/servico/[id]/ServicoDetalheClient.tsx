"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, MapPin, Phone, Lock, CheckCircle2, X } from "lucide-react";
import { iniciarServico, concluirVisita, obterVisitaAberta, sugerirMaoObraDaVisita } from "../../actions";
import { Badge } from "@/components/ui/Badge";
import { MAO_OBRA_OPCOES, HORAS_MAO_OBRA } from "@/lib/mao-obra";

function formatEuros(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

type LinhaMaterial = { nome: string; qtd: string; precoUnit: string };
type CatalogItem = { id: string; referencia: string; descricao: string; preco_venda: number };

export function ServicoDetalheClient({
  servico,
  materiaisPrevistos,
  catalogo,
  valorHoraMaoObra,
  visitaAbertaId,
}: {
  servico: any;
  materiaisPrevistos: { nome: string; qtd: number; preco_venda: number }[];
  catalogo: CatalogItem[];
  valorHoraMaoObra: number;
  visitaAbertaId: string | null;
}) {
  const router = useRouter();
  const [visitaId, setVisitaId] = useState<string | null>(visitaAbertaId);
  const [aFinalizar, setAFinalizar] = useState(false);
  const [aAbrirFinalizar, setAAbrirFinalizar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [resultado, setResultado] = useState<"concluido" | "nova_visita" | "nao_realizado">("concluido");
  const [trabalho, setTrabalho] = useState("");
  const [materiaisLinhas, setMateriaisLinhas] = useState<LinhaMaterial[]>(() =>
    materiaisPrevistos.map((m) => ({ nome: m.nome, qtd: String(m.qtd), precoUnit: String(m.preco_venda ?? 0) }))
  );
  const [maoObraTipo, setMaoObraTipo] = useState("");
  const [maoObraDetalhe, setMaoObraDetalhe] = useState("");
  const [agendouNovaData, setAgendouNovaData] = useState<"sim" | "nao" | null>(null);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");
  const [problemaIdentificado, setProblemaIdentificado] = useState("");
  const [equipamentoInstalado, setEquipamentoInstalado] = useState("");
  // Onda 2: pré-preenchida com "1" quando o serviço é Instalação — é o caso
  // mais comum, e continua totalmente editável.
  const [quantidadeInstalada, setQuantidadeInstalada] = useState(servico.tipo === "Instalação" ? "1" : "");
  const [testesRealizados, setTestesRealizados] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const isInstalacao = servico.tipo === "Instalação";

  const atualizarLinha = (i: number, patch: Partial<LinhaMaterial>) => {
    setMateriaisLinhas((linhas) => linhas.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const removerLinha = (i: number) => {
    setMateriaisLinhas((linhas) => linhas.filter((_, idx) => idx !== i));
  };

  const adicionarLinhaManual = () => {
    setMateriaisLinhas((linhas) => [...linhas, { nome: "", qtd: "1", precoUnit: "0" }]);
  };

  const adicionarDoCatalogo = (item: CatalogItem) => {
    setMateriaisLinhas((linhas) => [
      ...linhas,
      { nome: item.descricao, qtd: "1", precoUnit: String(item.preco_venda) },
    ]);
  };

  const totalMateriais = materiaisLinhas.reduce(
    (soma, l) => soma + (Number(l.qtd) || 0) * (Number(l.precoUnit) || 0),
    0
  );
  const totalMaoObra = (HORAS_MAO_OBRA[maoObraTipo] ?? 0) * valorHoraMaoObra;

  const iniciar = async () => {
    setAGuardar(true);
    setErro(null);
    try {
      const novaVisitaId = await iniciarServico(servico.id);
      setVisitaId(novaVisitaId);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAGuardar(false);
    }
  };

  // Antes de mostrar o formulário de fecho, vai sempre confirmar qual é a
  // visita aberta diretamente à BD — nunca confiar apenas no valor recebido
  // por prop no render inicial da página, que pode estar desatualizado.
  const abrirFinalizar = async () => {
    setAAbrirFinalizar(true);
    setErro(null);
    try {
      const id = await obterVisitaAberta(servico.id);
      if (!id) {
        setErro("Não encontrei nenhuma visita em curso para este serviço. Recarrega a página e tenta novamente.");
        return;
      }
      setVisitaId(id);
      // Onda 2: sugere a mão de obra a partir da duração real da visita —
      // só se o Técnico ainda não tiver escolhido nada (nunca substitui uma
      // escolha manual já feita, mesmo que ele volte atrás e reabra o
      // formulário). Falha em silêncio se não conseguir sugerir: o campo
      // fica vazio, exatamente como já era antes desta onda.
      if (!maoObraTipo) {
        try {
          const sugestao = await sugerirMaoObraDaVisita(id);
          if (sugestao) setMaoObraTipo(sugestao);
        } catch {
          // sugestão é só conveniência — nunca deve impedir o fecho do serviço.
        }
      }
      setAFinalizar(true);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAAbrirFinalizar(false);
    }
  };

  const submeter = async () => {
    let idParaSubmeter = visitaId;
    if (!idParaSubmeter) {
      // Rede de segurança: mesmo que por alguma razão o id se tenha perdido
      // entretanto, tenta ir buscá-lo mais uma vez antes de desistir — nunca
      // falhar em silêncio como acontecia antes.
      idParaSubmeter = await obterVisitaAberta(servico.id);
      if (!idParaSubmeter) {
        setErro("Não encontrei a visita em curso. Recarrega a página e tenta novamente antes de confirmar.");
        return;
      }
      setVisitaId(idParaSubmeter);
    }

    if (resultado === "concluido") {
      if (isInstalacao) {
        if (!equipamentoInstalado.trim()) {
          setErro("Indica o equipamento instalado.");
          return;
        }
        if (!quantidadeInstalada || Number(quantidadeInstalada) <= 0) {
          setErro("Indica a quantidade instalada.");
          return;
        }
      } else {
        if (!problemaIdentificado.trim()) {
          setErro("Descreve o problema identificado.");
          return;
        }
      }
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
      if (isInstalacao && !testesRealizados.trim()) {
        setErro("Descreve os testes realizados.");
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
          ? materiaisLinhas
              .filter((m) => m.nome.trim() && Number(m.qtd) > 0)
              .map((m) => ({ nome: m.nome.trim(), qtd: Number(m.qtd), precoUnit: Number(m.precoUnit) || 0 }))
          : [];
      await concluirVisita({
        visitId: idParaSubmeter,
        serviceId: servico.id,
        resultado,
        trabalhoRealizado: trabalho,
        materiais,
        fotos: [],
        maoObraTipo: resultado === "concluido" ? maoObraTipo : null,
        maoObraDetalhe: resultado === "concluido" && maoObraTipo === "outro" ? maoObraDetalhe : null,
        novaDataAgendada: resultado === "nova_visita" && agendouNovaData === "sim" ? novaData : null,
        novaHoraAgendada: resultado === "nova_visita" && agendouNovaData === "sim" ? novaHora : null,
        problemaIdentificado: resultado === "concluido" && !isInstalacao ? problemaIdentificado : null,
        equipamentoInstalado: resultado === "concluido" && isInstalacao ? equipamentoInstalado : null,
        quantidadeInstalada: resultado === "concluido" && isInstalacao ? Number(quantidadeInstalada) : null,
        testesRealizados: resultado === "concluido" && isInstalacao ? testesRealizados : null,
      });
      setSucesso(true);
      setTimeout(() => {
        router.push("/tecnico");
        router.refresh();
      }, 900);
    } catch (e: any) {
      setErro(e.message);
      setAGuardar(false);
    }
  };

  return (
    <div className="px-4 py-4">
      <Link href="/tecnico" className="mb-3 inline-block text-sm text-neutral-400">
        ← Agenda
      </Link>

      <div className="mb-3 flex items-center justify-between">
        <Badge estado={servico.estado} />
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-200">{servico.tipo}</span>
      </div>

      {servico.estado === "correcao_necessaria" && servico.motivo_correcao && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">O Admin pediu uma correção:</span> {servico.motivo_correcao}
          </span>
        </div>
      )}

      <h1 className="text-xl font-bold text-white">{servico.cliente_nome}</h1>
      {servico.detalhes_visiveis ? (
        <>
          {servico.morada && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(servico.morada)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-sm text-neutral-200 underline"
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {servico.morada}
            </a>
          )}
          {servico.cliente_telefone && <p className="mt-1 text-sm text-neutral-400">{servico.cliente_telefone}</p>}
          {servico.cliente_telefone && (
            <a
              href={`tel:${servico.cliente_telefone}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> Chamar cliente
            </a>
          )}
        </>
      ) : (
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-400">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" /> Morada, contacto e descrição ficam visíveis quando este for o próximo serviço.
        </p>
      )}

      {servico.detalhes_visiveis && (
        <div className="mt-4 rounded-lg bg-neutral-900 p-3 shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase text-neutral-500">Descrição</div>
          <p className="text-sm text-neutral-200">{servico.descricao}</p>
        </div>
      )}

      {servico.notas && (
        <div className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-400">{servico.notas}</div>
      )}

      {servico.detalhes_visiveis && materiaisPrevistos.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase text-neutral-500">Materiais previstos</div>
          <ul className="list-disc pl-5 text-sm text-neutral-300">
            {materiaisPrevistos.map((m, i) => (
              <li key={i}>
                {m.nome} × {m.qtd}
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}

      <div className="mt-6">
        {!servico.desbloqueado &&
          ["agendado", "nova_visita", "correcao_necessaria"].includes(servico.estado) &&
          !aFinalizar && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-neutral-800 p-3 text-center text-sm text-neutral-400">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" /> Fecha o serviço anterior para poderes iniciar este.
            </div>
          )}

        {servico.desbloqueado &&
          ["agendado", "nova_visita", "correcao_necessaria"].includes(servico.estado) &&
          !aFinalizar && (
            <button
              onClick={iniciar}
              disabled={aGuardar}
              className="w-full rounded-md bg-white px-4 py-3 text-sm font-medium text-neutral-950 disabled:opacity-40"
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
            onClick={abrirFinalizar}
            disabled={aAbrirFinalizar}
            className="w-full rounded-md bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {aAbrirFinalizar ? "A preparar…" : "Terminar serviço"}
          </button>
        )}

        {aFinalizar && sucesso && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-1 h-8 w-8" aria-hidden="true" />
            <p className="text-sm font-semibold text-emerald-400">Serviço encerrado com sucesso.</p>
            <p className="mt-1 text-xs text-emerald-400">A voltar à agenda…</p>
          </div>
        )}

        {aFinalizar && !sucesso && (
          <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-neutral-200">Resultado</div>
              <div className="space-y-2">
                {[
                  ["concluido", "Serviço concluído"],
                  ["nova_visita", "Precisa de nova visita"],
                  ["nao_realizado", "Não foi possível realizar"],
                ].map(([val, lbl]) => (
                  <label
                    key={val}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                      resultado === val ? "border-white bg-neutral-800" : "border-neutral-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resultado"
                      checked={resultado === val}
                      onChange={() => {
                        setResultado(val as any);
                        setMateriaisLinhas(
                          materiaisPrevistos.map((m) => ({ nome: m.nome, qtd: String(m.qtd), precoUnit: String(m.preco_venda ?? 0) }))
                        );
                        setMaoObraTipo("");
                        setMaoObraDetalhe("");
                        setAgendouNovaData(null);
                        setNovaData("");
                        setNovaHora("");
                        setProblemaIdentificado("");
                        setEquipamentoInstalado("");
                        setQuantidadeInstalada(isInstalacao ? "1" : "");
                        setTestesRealizados("");
                        setErro(null);
                      }}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            {resultado === "concluido" && !isInstalacao && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-300">Problema identificado (obrigatório)</span>
                <textarea
                  rows={2}
                  value={problemaIdentificado}
                  onChange={(e) => setProblemaIdentificado(e.target.value)}
                  className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                  placeholder="ex: disjuntor a disparar por sobrecarga"
                />
              </label>
            )}

            {resultado === "concluido" && isInstalacao && (
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-2 block">
                  <span className="mb-1 block text-xs font-medium text-neutral-300">Equipamento instalado (obrigatório)</span>
                  <input
                    value={equipamentoInstalado}
                    onChange={(e) => setEquipamentoInstalado(e.target.value)}
                    className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                    placeholder="ex: Câmara IP 4MP"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-300">Qtd (obrigatório)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantidadeInstalada}
                    onChange={(e) => setQuantidadeInstalada(e.target.value)}
                    className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-300">
                {resultado === "concluido" ? "Trabalho realizado (obrigatório)" : "Notas (obrigatório)"}
              </span>
              <textarea
                rows={3}
                value={trabalho}
                onChange={(e) => setTrabalho(e.target.value)}
                className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                placeholder="Descreve o que foi feito…"
              />
            </label>

            {resultado === "concluido" && (
              <>
                <div>
                  <span className="mb-1 block text-xs font-medium text-neutral-300">
                    Materiais utilizados
                  </span>
                  {servico.detalhes_visiveis && materiaisPrevistos.length > 0 && (
                    <p className="mb-2 text-xs text-amber-400">
                      Levaste este material para este serviço e registaste tudo o que utilizaste? Confirma
                      quantidades e preços — se usaste mais, menos, ou algo diferente do previsto, ajusta aqui.
                    </p>
                  )}

                  <div className="space-y-2">
                    {materiaisLinhas.map((linha, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-md border border-neutral-700 p-2">
                        <input
                          value={linha.nome}
                          onChange={(e) => atualizarLinha(i, { nome: e.target.value })}
                          placeholder="Material"
                          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={linha.qtd}
                          onChange={(e) => atualizarLinha(i, { qtd: e.target.value })}
                          placeholder="Qtd"
                          className="w-12 shrink-0 rounded-md border border-neutral-700 bg-transparent px-1.5 py-1.5 text-center text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={linha.precoUnit}
                          onChange={(e) => atualizarLinha(i, { precoUnit: e.target.value })}
                          placeholder="€/un"
                          className="w-16 shrink-0 rounded-md border border-neutral-700 bg-transparent px-1.5 py-1.5 text-center text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removerLinha(i)}
                          aria-label="Remover material"
                          className="shrink-0 px-1 text-neutral-500"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {catalogo.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const item = catalogo.find((c) => c.id === e.target.value);
                        if (item) adicionarDoCatalogo(item);
                      }}
                      className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                    >
                      <option value="">+ Adicionar do catálogo…</option>
                      {catalogo.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.referencia} — {c.descricao} ({formatEuros(c.preco_venda)})
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={adicionarLinhaManual}
                    className="mt-2 text-xs font-medium text-neutral-300 underline"
                  >
                    + Adicionar material manualmente
                  </button>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-300">Mão de obra (obrigatório)</span>
                  <select
                    value={maoObraTipo}
                    onChange={(e) => setMaoObraTipo(e.target.value)}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
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
                    <span className="mb-1 block text-xs font-medium text-neutral-300">Descreve a mão de obra</span>
                    <input
                      value={maoObraDetalhe}
                      onChange={(e) => setMaoObraDetalhe(e.target.value)}
                      className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                      placeholder="ex: 3 técnicos, meio-dia cada"
                    />
                  </label>
                )}

                {(totalMateriais > 0 || maoObraTipo) && (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-400">Materiais</span>
                      <span className="font-medium text-neutral-200">{formatEuros(totalMateriais)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-neutral-400">Mão de obra</span>
                      <span className="font-medium text-neutral-200">{formatEuros(totalMaoObra)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-sm">
                      <span className="font-semibold text-white">Total do serviço</span>
                      <span className="font-semibold text-white">{formatEuros(totalMateriais + totalMaoObra)}</span>
                    </div>
                  </div>
                )}

                {isInstalacao && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-neutral-300">Testes realizados (obrigatório)</span>
                    <textarea
                      rows={2}
                      value={testesRealizados}
                      onChange={(e) => setTestesRealizados(e.target.value)}
                      className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
                      placeholder="ex: testado funcionamento remoto, gravação confirmada"
                    />
                  </label>
                )}
              </>
            )}

            {resultado === "nova_visita" && (
              <div>
                <span className="mb-2 block text-xs font-medium text-neutral-300">
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
                          ? "border-white bg-neutral-800 text-neutral-200"
                          : "border-neutral-700 text-neutral-200"
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
                      className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-sm"
                    />
                    <input
                      type="time"
                      value={novaHora}
                      onChange={(e) => setNovaHora(e.target.value)}
                      className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-sm"
                    />
                  </div>
                )}
                {agendouNovaData === "nao" && (
                  <p className="mt-2 text-xs text-neutral-400">
                    O Admin vai ver este serviço como pendente de agendamento.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setAFinalizar(false)}
                className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200"
              >
                Voltar
              </button>
              <button
                onClick={submeter}
                disabled={aGuardar}
                className="flex-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
              >
                {aGuardar ? "A guardar…" : "Confirmar"}
              </button>
            </div>
          </div>
        )}

        {servico.estado === "aguarda_validacao" && !aFinalizar && (
          <div className="rounded-lg bg-neutral-900 p-3 text-sm text-neutral-400 shadow-sm">
            Serviço concluído — aguarda validação do Admin antes de seguir para faturação.
          </div>
        )}

        {["concluido", "nao_realizado"].includes(servico.estado) && !aFinalizar && (
          <div className="rounded-lg bg-neutral-900 p-3 text-sm text-neutral-400 shadow-sm">
            Este serviço já foi encerrado. Fala com o administrador para reabrir se for necessário.
          </div>
        )}
      </div>
    </div>
  );
}
