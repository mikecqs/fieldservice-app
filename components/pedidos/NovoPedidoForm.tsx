"use client";

import { useState } from "react";
import Link from "next/link";
import { criarPedido } from "@/app/admin/pedidos/actions";
import { ClienteMoradaFields } from "@/components/ClienteMoradaFields";

type Morada = { id: string; label: string; endereco: string };
type Cliente = { id: string; nome: string; codigo?: string | null; nif?: string | null; telefone?: string | null; client_addresses: Morada[] };

// Formulário partilhado por /admin/pedidos/novo e /atendimento/pedidos/novo —
// mesmo fluxo rápido de loja para as duas roles: Cliente → Morada → Tipo →
// Origem → Descrição → Guardar. As moradas mostradas vêm sempre só do
// `client_addresses` já aninhado do cliente selecionado (nunca uma lista
// solta filtrada por id), por isso nunca é possível misturar a morada de um
// cliente com o pedido de outro.
export function NovoPedidoForm({
  clientesIniciais,
  tipos,
  origens,
  showInfoFalta,
  permitirDecisaoOrcamento,
  voltarHref,
  clientIdInicial,
}: {
  clientesIniciais: Cliente[];
  tipos: string[];
  origens: string[];
  showInfoFalta: boolean;
  // Onda 3 (Etapa 10) — mostra inline "É necessário orçamento?" quando o
  // tipo não é "Orçamento" nem "Agendamento" (hoje: Manutenção/Instalação);
  // gate também "É necessária visita prévia?" sempre que o pedido vai dar
  // um Orçamento. false no Atendimento, que nunca chega a decidir nenhuma
  // das duas (é redirecionado para a sua própria ficha de pedido antes de
  // criarPedido() sequer olhar para tipo/necessita_orcamento).
  permitirDecisaoOrcamento: boolean;
  voltarHref: string;
  // Vindo de "Novo cliente → Sim, criar pedido" (BLOCO 4) — pré-seleciona o
  // cliente sem obrigar a procurá-lo outra vez. Só é usado se o id vier
  // mesmo na lista de clientes recebida (nunca confiar cegamente num
  // parâmetro de URL).
  clientIdInicial?: string;
}) {
  const [clientes, setClientes] = useState(clientesIniciais);
  const [clientId, setClientId] = useState(
    clientIdInicial && clientesIniciais.some((c) => c.id === clientIdInicial) ? clientIdInicial : ""
  );
  // Onda 3 — se o cliente pré-selecionado (vindo de "Novo cliente → Sim,
  // criar pedido") já tiver exatamente uma morada, fica logo escolhida;
  // continua trocável como qualquer outra seleção.
  const [addressId, setAddressId] = useState(() => {
    const clienteInicial =
      clientIdInicial ? clientesIniciais.find((c) => c.id === clientIdInicial) : undefined;
    return clienteInicial?.client_addresses.length === 1 ? clienteInicial.client_addresses[0].id : "";
  });
  const [erro, setErro] = useState<string | null>(null);
  // Impede duplo clique/reenvio em "Guardar pedido" a criar dois Pedidos —
  // só desativa o botão no cliente; onSubmit nunca chama preventDefault()
  // nem invoca criarPedido() manualmente, para o <form> continuar nativo e
  // o redirect() dentro de criarPedido() continuar a funcionar tal como
  // antes (um wrapper com try/catch à volta da Server Action apanharia esse
  // redirect como se fosse um erro comum).
  const [submetendo, setSubmetendo] = useState(false);

  // Onda 3 (Etapa 10) — "Tipo" passa a controlado só para se poder mostrar
  // a pergunta "É necessário orçamento?" logo que o Admin o escolhe, sem
  // mudar em nada a submissão nativa do formulário (continua um <select
  // name="tipo"> normal). Mesma condição implícita já usada em
  // criarPedido() do lado do servidor: nunca nomeia "Manutenção"/
  // "Instalação" diretamente, só exclui os dois tipos que já têm caminho
  // automático próprio — assim nunca diverge se a lista de tipos crescer.
  const [tipo, setTipo] = useState("");
  const [necessitaOrcamento, setNecessitaOrcamento] = useState<"sim" | "nao" | "">("");
  const precisaDecisao = tipo !== "" && tipo !== "Orçamento" && tipo !== "Agendamento";

  // Pergunta "É necessária visita prévia?" — só faz sentido quando o pedido
  // vai mesmo dar um Orçamento: tipo "Orçamento" direto, ou "sim" à
  // pergunta acima (Manutenção/Instalação). Mesmo `permitirDecisaoOrcamento`
  // que já gate a pergunta de orçamento (false no Atendimento, que nunca
  // decide nenhuma das duas).
  const [necessitaVisitaPrevia, setNecessitaVisitaPrevia] = useState<"sim" | "nao" | "">("");
  const vaiParaOrcamento = tipo === "Orçamento" || necessitaOrcamento === "sim";
  const mostrarPerguntaVisita = permitirDecisaoOrcamento && vaiParaOrcamento;
  const bloqueiaPorVisita = mostrarPerguntaVisita && !necessitaVisitaPrevia;

  const bloqueiaPorDecisao = (permitirDecisaoOrcamento && precisaDecisao && !necessitaOrcamento) || bloqueiaPorVisita;

  const podeGuardar = Boolean(clientId && addressId) && !bloqueiaPorDecisao;

  return (
    <form action={criarPedido} onSubmit={() => setSubmetendo(true)} className="grid grid-cols-1 gap-4">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="address_id" value={addressId} />

      {erro && <p className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-400">{erro}</p>}

      <ClienteMoradaFields
        clientes={clientes}
        onClientesChange={setClientes}
        clientId={clientId}
        onClientIdChange={setClientId}
        addressId={addressId}
        onAddressIdChange={setAddressId}
        onErro={setErro}
        camposNovoCliente="completo"
        permitirPesquisa
        mostrarCodigoCliente
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Tipo</span>
        <select
          name="tipo"
          required
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setNecessitaOrcamento("");
            setNecessitaVisitaPrevia("");
          }}
          className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            — Selecionar —
          </option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      {/* Onda 3 (Etapa 10) — substitui a navegação para
          /admin/pedidos/[id]/decisao: a mesma pergunta, agora dentro do
          próprio formulário. O valor viaja num input escondido; criarPedido()
          usa-o para decidir logo (criarOrcamentoDePedido/criarServicoDePedido,
          as mesmas funções que a página /decisao já usava) sem página extra.
          Página e Server Actions antigas ficam como rede de segurança, não
          removidas. */}
      {permitirDecisaoOrcamento && precisaDecisao && (
        <div className="rounded-md border border-neutral-700 bg-neutral-800 p-3">
          <input type="hidden" name="necessita_orcamento" value={necessitaOrcamento} />
          <span className="mb-2 block text-xs font-medium text-neutral-300">É necessário orçamento?</span>
          <div className="flex gap-2">
            {(["sim", "nao"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setNecessitaOrcamento(v);
                  setNecessitaVisitaPrevia("");
                }}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  necessitaOrcamento === v
                    ? "border-white bg-neutral-900 text-neutral-100"
                    : "border-neutral-700 text-neutral-300"
                }`}
              >
                {v === "sim" ? "Sim" : "Não"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sempre que o pedido vai dar um Orçamento (tipo "Orçamento" direto,
          ou "sim" acima) — nunca quando vai dar logo um Serviço. "Sim" cria
          uma Visita Prévia (Serviço com tipo próprio, agendada na Agenda);
          "não" segue tal como já seguia antes desta pergunta existir. */}
      {mostrarPerguntaVisita && (
        <div className="rounded-md border border-neutral-700 bg-neutral-800 p-3">
          <input type="hidden" name="necessita_visita_previa" value={necessitaVisitaPrevia} />
          <span className="mb-2 block text-xs font-medium text-neutral-300">É necessária visita prévia?</span>
          <div className="flex gap-2">
            {(["sim", "nao"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setNecessitaVisitaPrevia(v)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  necessitaVisitaPrevia === v
                    ? "border-white bg-neutral-900 text-neutral-100"
                    : "border-neutral-700 text-neutral-300"
                }`}
              >
                {v === "sim" ? "Sim, agendar visita prévia" : "Não, seguir para orçamento"}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Origem</span>
        <select name="origem" required defaultValue="" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
          <option value="" disabled>
            — Selecionar —
          </option>
          {origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      {/* Onda 3 (Etapa 9) — mesmos valores/rótulos já usados em NovoServicoForm/
          ServicoModal/AgendamentoForm para prioridade; "requests" não tem
          coluna própria, por isso este valor só é aproveitado quando o tipo
          é "Agendamento" (serviço criado já dentro desta submissão) — ver
          criarPedido()/criarServicoDePedido(). Nos outros tipos, o campo
          existe mas o valor não tem onde ser guardado ainda, e o serviço
          eventualmente criado mais tarde continua a nascer com "normal",
          exatamente como já acontecia antes desta etapa. */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Prioridade</span>
        <select name="prioridade" defaultValue="normal" className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm">
          <option value="baixa">Baixa</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-300">Descrição</span>
        <textarea name="descricao" required rows={3} className="w-full rounded-md border border-neutral-700 px-3 py-2 text-sm" />
      </label>

      {showInfoFalta && (
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="info_falta" className="rounded border-neutral-700" />
          Falta informação do cliente para avançar
        </label>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Link href={voltarHref} className="rounded-md border border-neutral-700 px-3.5 py-2 text-sm text-neutral-200">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={!podeGuardar || submetendo}
          title={
            submetendo
              ? undefined
              : bloqueiaPorDecisao
              ? "Responde às perguntas acima antes de guardar"
              : !podeGuardar
              ? "Seleciona o cliente e a morada primeiro"
              : undefined
          }
          className="rounded-md bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submetendo ? "A guardar…" : "Guardar pedido"}
        </button>
      </div>
    </form>
  );
}
