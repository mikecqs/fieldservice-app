// Testes das regras de estado (lib/*-estado.ts) — a fonte única de verdade
// das transições, usada tanto pelas Server Actions como pela UI. Se uma
// destas regras mudar por engano, o CI falha antes de chegar a produção.
// describe/it/expect vêm como globais do vitest (ver vitest.config.mts).
import {
  podeReagendarServico,
  deveTransicionarParaAgendado,
  podeCancelarServico,
  podeReativarServico,
  rotuloTipoServico,
  podeGerarOrcamentoDeVisita,
  podeVoltarAoOrcamentoDaVisita,
  podeVerPdfFecho,
  TIPO_VISITA_ORCAMENTO,
} from "../servico-estado";
import {
  podeEditarItensOrcamento,
  podeMarcarEnviado,
  podeAceitarOrcamento,
  podeAvancarParaEstado,
} from "../orcamento-estado";
import { podeAvancarCompraParaEstado } from "../compra-estado";
import { estadoOperacionalPedido, podeDecidirPedido } from "../pedido-estado";

describe("Serviço", () => {
  it("reagendar: bloqueado se terminado ou faturado/liquidado", () => {
    for (const estado of ["concluido", "cancelado", "nao_realizado"]) {
      expect(podeReagendarServico({ estado })).toBe(false);
    }
    expect(podeReagendarServico({ estado: "agendado", faturacao_estado: "faturado" })).toBe(false);
    expect(podeReagendarServico({ estado: "agendado", faturacao_estado: "liquidado" })).toBe(false);
    expect(podeReagendarServico({ estado: "agendado", faturacao_estado: null })).toBe(true);
    expect(podeReagendarServico({ estado: "por_agendar" })).toBe(true);
  });

  it("auto-agendar só a partir de por_agendar/nova_visita", () => {
    expect(deveTransicionarParaAgendado("por_agendar")).toBe(true);
    expect(deveTransicionarParaAgendado("nova_visita")).toBe(true);
    expect(deveTransicionarParaAgendado("agendado")).toBe(false);
    expect(deveTransicionarParaAgendado("em_curso")).toBe(false);
  });

  it("cancelar: nunca concluído, cancelado ou faturado", () => {
    expect(podeCancelarServico({ estado: "concluido" })).toBe(false);
    expect(podeCancelarServico({ estado: "cancelado" })).toBe(false);
    expect(podeCancelarServico({ estado: "em_curso", faturacao_estado: "faturado" })).toBe(false);
    expect(podeCancelarServico({ estado: "agendado" })).toBe(true);
  });

  it("reativar: só nao_realizado e nunca faturado", () => {
    expect(podeReativarServico({ estado: "nao_realizado" })).toBe(true);
    expect(podeReativarServico({ estado: "nao_realizado", faturacao_estado: "faturado" })).toBe(false);
    expect(podeReativarServico({ estado: "cancelado" })).toBe(false);
  });

  it("rótulo da visita prévia não altera os outros tipos", () => {
    expect(rotuloTipoServico(TIPO_VISITA_ORCAMENTO)).toBe("Visita Prévia");
    expect(rotuloTipoServico("Instalação")).toBe("Instalação");
  });

  it("visita prévia: fluxo A (sem orçamento) vs fluxo B (com orçamento)", () => {
    const base = { tipo: TIPO_VISITA_ORCAMENTO, estado: "concluido" };
    expect(podeGerarOrcamentoDeVisita({ ...base, request_id: "r" })).toBe(true);
    expect(podeGerarOrcamentoDeVisita({ ...base, request_id: "r", budget_id: "b" })).toBe(false);
    expect(podeVoltarAoOrcamentoDaVisita({ ...base, budget_id: "b" })).toBe(true);
    expect(podeGerarOrcamentoDeVisita({ ...base, estado: "agendado", request_id: "r" })).toBe(false);
  });

  it("PDF de fecho só depois do técnico fechar", () => {
    expect(podeVerPdfFecho({ estado: "aguarda_validacao" })).toBe(true);
    expect(podeVerPdfFecho({ estado: "concluido" })).toBe(true);
    expect(podeVerPdfFecho({ estado: "em_curso" })).toBe(false);
  });
});

describe("Orçamento", () => {
  it("itens e envio só em rascunho", () => {
    expect(podeEditarItensOrcamento({ estado: "rascunho" })).toBe(true);
    expect(podeEditarItensOrcamento({ estado: "enviado" })).toBe(false);
    expect(podeMarcarEnviado({ estado: "rascunho" })).toBe(true);
    expect(podeMarcarEnviado({ estado: "enviado" })).toBe(false);
  });

  it("aceitar nunca a partir de estado terminal (evita serviço duplicado)", () => {
    for (const estado of ["aceite", "recusado", "cancelado"]) {
      expect(podeAceitarOrcamento({ estado })).toBe(false);
    }
    expect(podeAceitarOrcamento({ estado: "aguarda_resposta" })).toBe(true);
  });

  it("transições manuais validadas por origem", () => {
    expect(podeAvancarParaEstado({ estado: "enviado" }, "aguarda_resposta")).toBe(true);
    expect(podeAvancarParaEstado({ estado: "rascunho" }, "aguarda_resposta")).toBe(false);
    expect(podeAvancarParaEstado({ estado: "aceite" }, "cancelado")).toBe(false);
    expect(podeAvancarParaEstado({ estado: "enviado" }, "aceite")).toBe(false); // aceite tem ação própria
    expect(podeAvancarParaEstado({ estado: "enviado" }, "qualquer_coisa")).toBe(false);
  });
});

describe("Compra", () => {
  it("só por_encomendar→encomendada e encomendada/parcial→recebida", () => {
    expect(podeAvancarCompraParaEstado({ estado: "por_encomendar" }, "encomendada")).toBe(true);
    expect(podeAvancarCompraParaEstado({ estado: "encomendada" }, "recebida")).toBe(true);
    expect(podeAvancarCompraParaEstado({ estado: "parcial" }, "recebida")).toBe(true);
    expect(podeAvancarCompraParaEstado({ estado: "por_encomendar" }, "recebida")).toBe(false);
    expect(podeAvancarCompraParaEstado({ estado: "recebida" }, "cancelada")).toBe(false);
  });
});

describe("Pedido", () => {
  it("decidir só enquanto novo", () => {
    expect(podeDecidirPedido({ estado: "novo" })).toBe(true);
    expect(podeDecidirPedido({ estado: "arquivado" })).toBe(false);
  });

  it("serviço real tem prioridade sobre orçamento e visita prévia", () => {
    const r = estadoOperacionalPedido(
      { estado: "novo", info_falta: false },
      { estado: "aceite" },
      [
        { estado: "concluido", tipo: TIPO_VISITA_ORCAMENTO },
        { estado: "agendado", tipo: "Instalação" },
      ]
    );
    expect(r.grupo).toBe("andamento");
  });

  it("info em falta força sempre o grupo 'acao'", () => {
    const r = estadoOperacionalPedido({ estado: "novo", info_falta: true }, undefined, [
      { estado: "concluido", tipo: "Instalação" },
    ]);
    expect(r.grupo).toBe("acao");
  });

  it("pedido novo sem nada a jusante pede ação", () => {
    const r = estadoOperacionalPedido({ estado: "novo", info_falta: false }, undefined, []);
    expect(r).toMatchObject({ label: "Novo", grupo: "acao" });
  });
});
