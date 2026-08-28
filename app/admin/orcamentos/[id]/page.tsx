import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularOrcamento } from "@/lib/orcamento";
import { removerItem, marcarEnviado, avancarEstado, aceitarOrcamento, atualizarIva } from "../actions";
import { AdicionarItemForm } from "./AdicionarItemForm";

const TIPO_LABEL: Record<string, string> = {
  materiais: "Materiais",
  mao_obra: "Mão de obra",
  deslocacao: "Deslocação",
  outros: "Outros",
};

export default async function OrcamentoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: orcamento }, { data: catalogo }] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, clients(nome, telefone, email), budget_items(*)")
      .eq("id", params.id)
      .single(),
    supabase.from("catalog_items").select("id, referencia, descricao, preco_venda").order("referencia").limit(500),
  ]);

  if (!orcamento) notFound();

  const items = orcamento.budget_items ?? [];
  const { subtotal, ivaValor, total } = calcularOrcamento(items, orcamento.iva_percent);

  const telefoneWhatsapp = orcamento.clients?.telefone?.replace(/\D/g, "");
  const mensagemPartilha = `Olá ${orcamento.clients?.nome ?? ""}, aqui tem o orçamento (total ${total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}). Vou enviar o PDF de seguida.`;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/orcamentos" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Orçamentos
      </Link>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-1 flex items-start justify-between">
          <h1 className="text-lg font-bold text-slate-900">{orcamento.clients?.nome}</h1>
          <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {orcamento.estado}
          </span>
        </div>
        <p className="text-xs text-slate-400">Criado {orcamento.criado_em}</p>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <a
            href={`/admin/orcamentos/${orcamento.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            📄 Download PDF
          </a>
          <a
            href={`https://wa.me/${telefoneWhatsapp ?? ""}?text=${encodeURIComponent(mensagemPartilha)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            📱 Partilhar por WhatsApp
          </a>
          {orcamento.clients?.email && (
            <a
              href={`mailto:${orcamento.clients.email}?subject=${encodeURIComponent("Orçamento")}&body=${encodeURIComponent(
                mensagemPartilha + "\n\n(Descarrega o PDF acima e anexa-o a este email antes de enviar.)"
              )}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ✉️ Partilhar por email
            </a>
          )}
        </div>

        {orcamento.estado !== "aceite" && orcamento.estado !== "cancelado" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {orcamento.estado === "rascunho" && (
              <form action={marcarEnviado}>
                <input type="hidden" name="id" value={orcamento.id} />
                <button className="rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">
                  Marcar como enviado
                </button>
              </form>
            )}
            {orcamento.estado === "enviado" && (
              <form action={avancarEstado}>
                <input type="hidden" name="id" value={orcamento.id} />
                <input type="hidden" name="estado" value="aguarda_resposta" />
                <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  Aguarda resposta
                </button>
              </form>
            )}
            {(orcamento.estado === "aguarda_resposta" || orcamento.estado === "enviado") && (
              <form action={avancarEstado}>
                <input type="hidden" name="id" value={orcamento.id} />
                <input type="hidden" name="estado" value="followup" />
                <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
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
              <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">
                Recusado
              </button>
            </form>
            <form action={avancarEstado}>
              <input type="hidden" name="id" value={orcamento.id} />
              <input type="hidden" name="estado" value="cancelado" />
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                Cancelar
              </button>
            </form>
          </div>
        )}

        {orcamento.estado === "aceite" && orcamento.service_id && (
          <Link
            href={`/admin/servicos/${orcamento.service_id}`}
            className="mt-4 inline-block text-sm text-indigo-700 underline"
          >
            Ver serviço criado →
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Linhas do orçamento</h2>
        <div className="space-y-1.5">
          {items.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between rounded-md border border-slate-100 p-2.5 text-sm">
              <div>
                <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {TIPO_LABEL[i.tipo] ?? i.tipo}
                </span>
                {i.descricao} · {i.qtd} × {Number(i.valor_unit).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">
                  {(i.qtd * i.valor_unit).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </span>
                {orcamento.estado === "rascunho" && (
                  <form action={removerItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="budget_id" value={orcamento.id} />
                    <button className="text-xs text-red-600 hover:underline">remover</button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Sem linhas ainda.</p>}
        </div>
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-end gap-2 text-slate-500">
            <span>Subtotal:</span>
            <span>{subtotal.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
          </div>
          <div className="flex items-center justify-end gap-2 text-slate-500">
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
                  className="w-16 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs"
                />
                <span>%</span>
                <button className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200">
                  Atualizar
                </button>
              </form>
            ) : (
              <span>IVA ({orcamento.iva_percent}%):</span>
            )}
            <span>{ivaValor.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
          </div>
          <div className="flex justify-end gap-2 text-base font-bold text-slate-900">
            <span>Total:</span>
            <span>{total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
          </div>
        </div>

        {orcamento.estado === "rascunho" && (
          <AdicionarItemForm budgetId={orcamento.id} catalogo={catalogo ?? []} />
        )}
      </div>
    </div>
  );
}
