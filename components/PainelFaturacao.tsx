import { createClient } from "@/lib/supabase/server";
import { marcarFaturado, marcarLiquidado } from "@/app/admin/faturacao/actions";
import { validarServico, enviarParaCorrecao } from "@/app/admin/servicos/actions";
import { PedidoCodigoBadge } from "@/components/pedidos/PedidoCodigoBadge";
import { rotuloTipoServico } from "@/lib/servico-estado";
import { METODOS_PAGAMENTO } from "@/lib/faturacao-opcoes";
import { VerPdfFechoLink } from "@/components/VerPdfFechoLink";

// Partilhado entre /admin/faturacao (Admin) e /financeiro/faturacao (role
// FINANCE) — mesma consulta, mesmas ações (as RPCs finance_* já validam a
// permissão certa consoante quem chama), só muda quem consegue lá chegar.
export async function PainelFaturacao({
  q,
  titulo = "Faturação",
  subtitulo = "Serviços concluídos, por faturar, faturados ou já liquidados.",
}: {
  q?: string;
  titulo?: string;
  subtitulo?: string;
}) {
  const supabase = await createClient();

  const { data: aguardamValidacao } = await supabase
    .from("services")
    .select("id, tipo, descricao, valor, clients(nome, codigo), requests(codigo)")
    .eq("estado", "aguarda_validacao")
    .order("created_at", { ascending: false });

  const { data: servicos } = await supabase
    .from("services")
    .select(
      "id, tipo, descricao, valor, faturacao_estado, faturacao_data, faturacao_valor, faturacao_referencia, faturacao_metodo_pagamento, faturacao_liquidado_data, clients(nome, codigo), requests(id, codigo)"
    )
    .eq("estado", "concluido")
    .order("faturacao_estado")
    .order("created_at", { ascending: false });

  const termo = (q ?? "").trim().toLowerCase();
  const bate = (s: any) =>
    !termo ||
    s.clients?.nome?.toLowerCase().includes(termo) ||
    s.clients?.codigo?.toLowerCase().includes(termo) ||
    s.requests?.codigo?.toLowerCase().includes(termo) ||
    s.descricao?.toLowerCase().includes(termo) ||
    s.faturacao_referencia?.toLowerCase().includes(termo);

  const aguardam = (aguardamValidacao ?? []).filter(bate);
  const porFaturar = (servicos ?? []).filter((s) => s.faturacao_estado === "por_faturar").filter(bate);
  // 'faturado' aqui é só "emitida, ainda por receber" — assim que é
  // liquidado passa para a secção/estado seguinte, nunca fica nas duas.
  const faturados = (servicos ?? []).filter((s) => s.faturacao_estado === "faturado").filter(bate);
  const liquidados = (servicos ?? []).filter((s) => s.faturacao_estado === "liquidado").filter(bate);
  const totalPorFaturar = porFaturar.reduce((acc, s) => acc + Number(s.valor ?? 0), 0);
  // Faturado vs Recebido: "faturado" (por receber) soma o valor da fatura já
  // emitida mas ainda não paga; "recebido" soma o que já foi liquidado.
  const totalFaturadoPorReceber = faturados.reduce((acc, s) => acc + Number(s.faturacao_valor ?? 0), 0);
  const totalRecebido = liquidados.reduce((acc, s) => acc + Number(s.faturacao_valor ?? 0), 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">{titulo}</h1>
        <p className="mt-0.5 text-sm text-neutral-400">{subtitulo}</p>
      </div>

      <form method="get" className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Pesquisar por cliente, ID cliente, ID pedido, descrição ou nº fatura…"
          className="w-full max-w-md rounded-md border border-neutral-700 px-3 py-2 text-sm"
        />
      </form>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs font-medium text-neutral-400">Total por faturar</div>
          <div className="text-2xl font-bold text-white">
            {totalPorFaturar.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs font-medium text-neutral-400">Faturado · por receber</div>
          <div className="text-2xl font-bold text-white">
            {totalFaturadoPorReceber.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs font-medium text-neutral-400">Recebido · liquidado</div>
          <div className="text-2xl font-bold text-emerald-400">
            {totalRecebido.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-400">
        Aguardam validação · {aguardam.length}
      </h2>
      <div className="mb-6 space-y-2">
        {aguardam.map((s: any) => (
          <div key={s.id} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="font-medium text-neutral-100">{s.clients?.nome}</div>
                <div className="text-sm text-neutral-300">{rotuloTipoServico(s.tipo)} · {s.descricao}</div>
              </div>
              <span className="font-semibold text-neutral-200">
                {Number(s.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <VerPdfFechoLink servicoId={s.id} />
              <form action={validarServico}>
                <input type="hidden" name="id" value={s.id} />
                <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
                  Validar
                </button>
              </form>
              <details className="relative">
                <summary className="list-none cursor-pointer rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10">
                  Mandar para trás
                </summary>
                <form
                  action={enviarParaCorrecao}
                  className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-lg"
                >
                  <input type="hidden" name="id" value={s.id} />
                  <span className="block text-xs font-medium text-neutral-300">Motivo (obrigatório)</span>
                  <textarea
                    name="motivo"
                    required
                    rows={3}
                    className="w-full rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
                    placeholder="Ex: guia do Wintouch indica 5 câmaras, técnico registou 4."
                  />
                  <button className="w-full rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">
                    Confirmar rejeição
                  </button>
                </form>
              </details>
            </div>
          </div>
        ))}
        {aguardam.length === 0 && <p className="py-4 text-center text-sm text-neutral-500">Nada à espera de validação.</p>}
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Por faturar · {porFaturar.length}</h2>
      <div className="mb-6 space-y-2">
        {porFaturar.map((s: any) => (
          <div key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="font-medium text-neutral-100">{s.clients?.nome}</div>
                <div className="text-sm text-neutral-400">{rotuloTipoServico(s.tipo)} · {s.descricao}</div>
              </div>
              <span className="font-semibold text-neutral-200">
                {Number(s.valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VerPdfFechoLink servicoId={s.id} />
              <form action={marcarFaturado} className="flex flex-1 gap-2">
                <input type="hidden" name="id" value={s.id} />
                <input
                  name="faturacao_valor"
                  type="number"
                  step="0.01"
                  defaultValue={s.valor}
                  className="w-28 rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
                />
                <input
                  name="faturacao_referencia"
                  placeholder="Nº fatura / referência"
                  required
                  className="flex-1 rounded-md border border-neutral-700 px-2 py-1.5 text-xs"
                />
                <button className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
                  Marcar faturado
                </button>
              </form>
            </div>
          </div>
        ))}
        {porFaturar.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Nada por faturar.</p>}
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Faturados · {faturados.length}</h2>
      <div className="mb-6 space-y-2">
        {faturados.map((s: any) => (
          <div key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  {s.requests?.codigo && (
                    <PedidoCodigoBadge
                      id={s.requests.id}
                      codigo={s.requests.codigo}
                      className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono hover:bg-neutral-800 hover:text-white"
                    />
                  )}
                  {s.clients?.codigo && <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono">{s.clients.codigo}</span>}
                </div>
                <span className="font-medium text-neutral-200">{s.clients?.nome}</span>
                <span className="ml-2 text-neutral-500">{s.faturacao_referencia}</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-400">
                <span>{s.faturacao_data}</span>
                <span className="font-semibold text-neutral-200">
                  {Number(s.faturacao_valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </span>
                <VerPdfFechoLink
                  servicoId={s.id}
                  className="flex items-center gap-1 rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white"
                />
              </div>
            </div>
            <form action={marcarLiquidado} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              <select
                name="metodo_pagamento"
                required
                defaultValue=""
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
              >
                <option value="" disabled>
                  — Método de pagamento —
                </option>
                {METODOS_PAGAMENTO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
                Marcar liquidado
              </button>
            </form>
          </div>
        ))}
        {faturados.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Ainda sem faturas por receber.</p>}
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-500">Liquidados · {liquidados.length}</h2>
      <div className="space-y-2">
        {liquidados.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 text-sm">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                {s.requests?.codigo && (
                  <PedidoCodigoBadge
                    id={s.requests.id}
                    codigo={s.requests.codigo}
                    className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono hover:bg-neutral-800 hover:text-white"
                  />
                )}
                {s.clients?.codigo && <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono">{s.clients.codigo}</span>}
              </div>
              <span className="font-medium text-neutral-200">{s.clients?.nome}</span>
              <span className="ml-2 text-neutral-500">{s.faturacao_referencia}</span>
            </div>
            <div className="flex items-center gap-3 text-neutral-400">
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">{s.faturacao_metodo_pagamento}</span>
              <span>{s.faturacao_liquidado_data}</span>
              <span className="font-semibold text-neutral-200">
                {Number(s.faturacao_valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
              <VerPdfFechoLink
                servicoId={s.id}
                className="flex items-center gap-1 rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white"
              />
            </div>
          </div>
        ))}
        {liquidados.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Ainda sem pagamentos recebidos.</p>}
      </div>
    </div>
  );
}
