import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NovoPedidoForm } from "@/components/pedidos/NovoPedidoForm";
import { TIPOS_SERVICO as TIPOS, ORIGENS_PEDIDO as ORIGENS } from "@/lib/pedido-opcoes";

export default async function NovoPedidoPage(props: { searchParams: Promise<{ clientId?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, nome, codigo, nif, telefone, client_addresses(id, label, endereco)")
    .order("nome");

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/pedidos" className="mb-4 inline-block text-sm text-neutral-400 hover:text-neutral-100">
        ← Pedidos
      </Link>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="mb-4 text-lg font-bold text-white">Novo pedido</h1>
        <NovoPedidoForm
          clientesIniciais={(clients ?? []) as any}
          tipos={TIPOS}
          origens={ORIGENS}
          showInfoFalta
          permitirDecisaoOrcamento
          voltarHref="/admin/pedidos"
          // Vindo de "Novo cliente → Sim, criar pedido" (BLOCO 4): o cliente
          // já chega selecionado, sem o Admin ter de o procurar outra vez.
          clientIdInicial={searchParams.clientId}
        />
      </div>
    </div>
  );
}
