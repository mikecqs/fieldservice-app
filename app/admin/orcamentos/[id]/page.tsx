import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularOrcamento } from "@/lib/orcamento";
import { removerItem, marcarEnviado, avancarEstado, aceitarOrcamento, atualizarIva } from "../actions";
import { AdicionarItemForm } from "./AdicionarItemForm";
import { ESTADOS_ORCAMENTO_TERMINAIS } from "@/lib/orcamento-estado";

const TIPO_LABEL: Record<string, string> = {
  materiais: "Materiais",
  mao_obra: "Mão de obra",
  deslocacao: "Deslocação",
  outros: "Outros",
};

export default async function OrcamentoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: orcamento }, { data: catalogo }, { data: eventos }] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, clients(nome, telefone, email), budget_items(*)")
      .eq("id", params.id)
      .single(),
    supabase.from("catalog_items").select("id, referencia, descricao, preco_venda").order("referencia").limit(500),
    supabase
      .from("budget_events")
      .select("tipo, descricao, created_at, profiles(nome)")
      .eq("budget_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!orcamento) notFound();

  const items = orcamento.budget_items ?? [];
  const { subtotal, ivaValor, total } = calcularOrcamento(items, orcamento.iva_percent);

  const telefoneWhatsapp = orcamento.clients?.telefone?.replace(/\D/g, "");
  const mensagemPartilha = `Olá ${orcamento.clients?.nome ?? ""}, aqui tem o orçamento (total ${total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}). Vou enviar o PDF de seguida.`;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/orcamentos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Orçamentos
      </Link>

      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-1 flex items-start justify-between">
          <h1 className="text-lg font-bold text-white">#{orcamento.numero} · {orcamento.clients?.nome}</h1>
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-200">
            {orcamento.estado}
          </span>
        </div>
        <p className="text-xs text-neutral-500">Criado {orcamento.criado_em}</p>
        {orcamento.followup_em && !ESTADOS_ORCAMENTO_TERMINAIS.includes(orcamento.estado) && (
          <p className="mt-1 text-xs text-amber-400">Follow-up agendado para {orcamento.followup_em}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
          <a
            href={`/admin/orcamentos/${orcamento.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
          >
            📄 Download PDF
          </a>
          <a
            href={`https://wa.me/${telefoneWhatsapp ?? ""}?text=${encodeURIComponent(mensagemPartilha)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10"
          >
            📱 Partilhar por WhatsApp
          </a>
          {orcamento.clients?.email && (
            <a
              href={`mailto:${orcamento.clients.email}?subject=${encodeURIComponent("Orçamento")}&body=${encodeURIComponent(
                mensagemPartilha + "\n\n(Descarrega o PDF acima e anexa-o a este email antes de enviar.)"
              )}`}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
            >
              ✉️ Partilhar por email
            </a>
          )}
        </div>

        {!ESTADOS_ORCAMENTO_TERMINAIS.includes(orcamento.estado) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {orcamento.estado === "rascunho" && (
              <form action={marcarEnviado}>
                <input type="hidden" name="id" value={orcamento.id} />
                <button className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200">
                  Marcar como enviado
                </button>
              </form>
            )}
            {orcamento.estado === "enviado" && (
              <form action={avancarEstado}>
                <input type="hidden" name="id" value={orcamento.id} />
                <input type="hidden" name="estado" value="aguarda_resposta" />
                <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800">
                  Aguarda resposta
                </button>
              </form>
            )}
            {(orcamento.estado === "aguarda_resposta" || orcamento.estado === "enviado") && (
              <form action={avancarEstado}>
                <input type="hidden" name="id" value={orcamento.id} />
                <input type="hidden" name="estado" value="followup" />
                <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800">
                  Marcar follow-up
                </button>
              </form>
            )}
            <form action={aceitarOrcamento}>
              <input type="hidden" name="id" value={orcamento.id} />
              <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
                Aceite → criar serviço
              </button>
            </form>
            <form action={avancarEstado}>
              <input type="hidden" name="id" value={orcamento.id} />
              <input type="hidden" name="estado" value="recusado" />
              <button className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                Recusado
              </button>
            </form>
            <form action={avancarEstado}>
              <input type="hidden" name="id" value={orcamento.id} />
              <input type="hidden" name="estado" value="cancelado" />
              <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800">
                Cancelar
              </button>
            </form>
          </div>
        )}

        {orcamento.estado === "aceite" && orcamento.service_id && (
          <Link
            href={`/admin/servicos/${orcamento.service_id}`}
            className="mt-4 inline-block text-sm text-neutral-200 underline"
          >
            Ver serviço criado →
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-100">Linhas do orçamento</h2>
        <div className="space-y-1.5">
          {items.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between rounded-md border border-neutral-800 p-2.5 text-sm">
              <div>
                <span className="mr-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                  {TIPO_LABEL[i.tipo] ?? i.tipo}
                </span>
                {i.descricao} · {i.qtd} × {Number(i.valor_unit).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-200">
                  {(i.qtd * i.valor_unit).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </span>
                {orcamento.estado === "rascunho" && (
                  <form action={removerItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="budget_id" value={orcamento.id} />
                    <button className="text-xs text-red-400 hover:underline">remover</button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="py-4 text-center text-sm text-neutral-500">Sem linhas ainda.</p>}
        </div>
        <div className="mt-3 space-y-1 border-t border-neutral-800 pt-3 text-sm">
          <div className="flex justify-end gap-2 text-neutral-400">
            <span>Subtotal:</span>
            <span>{subtotal.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
          </div>
          <div className="flex items-center justify-end gap-2 text-neutral-400">
            {orcamento.estado === "rascunho" ? (
              <form action={atualizarIva} className="flex items-center gap-1.5">
                <input type="hidden" name="id" value={orcamento.id} />
                <span>IVA</span>
                <input
                  name="iva_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={orcamento.iva_percent}
                  className="w-16 rounded-md border border-neutral-700 px-1.5 py-0.5 text-xs"
                />
                <span>%</span>
                <button className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-800">
                  Atualizar
                </button>
              </form>
            ) : (
              <span>IVA ({orcamento.iva_percent}%):</span>
            )}
            <span>{ivaValor.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
          </div>
          <div className="flex justify-end gap-2 text-base font-bold text-white">
            <span>Total:</span>
            <span>{total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
          </div>
        </div>

        {orcamento.estado === "rascunho" && (
          <AdicionarItemForm budgetId={orcamento.id} catalogo={catalogo ?? []} />
        )}
      </div>

      {(eventos ?? []).length > 0 && (
        <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">Histórico</h2>
          <div className="space-y-2">
            {(eventos ?? []).map((e: any, i: number) => (
              <div key={i} className="rounded-md border border-neutral-800 p-3 text-sm">
                <div className="mb-1 flex justify-between text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-200">{e.tipo}</span>
                  <span>{new Date(e.created_at).toLocaleString("pt-PT")} · {e.profiles?.nome ?? "—"}</span>
                </div>
                <p className="text-neutral-300">{e.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
