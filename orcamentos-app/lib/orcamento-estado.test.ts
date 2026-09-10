// Testes unitários da máquina de estados (camada de app — a mesma lógica
// está replicada na base de dados pela migração 005, testada à parte em
// scripts/security-test.mjs porque precisa de um Supabase real). Cobre
// todos os estados existentes para cada predicado, para nenhuma
// transição nova ser esquecida silenciosamente no futuro.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ESTADOS_ORCAMENTO,
  podeAceitarOrcamento,
  podeCancelarOrcamento,
  podeEditarItensOrcamento,
  podeMarcarEnviado,
  podeMarcarFaturado,
  podeMarcarFollowup,
  podeMarcarServicoRealizado,
  podeRecusarOrcamento,
} from "./orcamento-estado";

function testarPredicado(
  nome: string,
  fn: (o: { estado: string }) => boolean,
  estadosVerdadeiros: readonly string[]
) {
  test(`${nome}: verdadeiro só para {${estadosVerdadeiros.join(", ")}}`, () => {
    for (const estado of ESTADOS_ORCAMENTO) {
      const esperado = (estadosVerdadeiros as readonly string[]).includes(estado);
      assert.equal(fn({ estado }), esperado, `${nome}({estado:"${estado}"}) devia ser ${esperado}`);
    }
  });
}

testarPredicado("podeEditarItensOrcamento", podeEditarItensOrcamento, ["rascunho"]);
testarPredicado("podeMarcarEnviado", podeMarcarEnviado, ["rascunho"]);
testarPredicado("podeMarcarFollowup", podeMarcarFollowup, ["enviado", "followup"]);
testarPredicado("podeAceitarOrcamento", podeAceitarOrcamento, ["rascunho", "enviado", "followup"]);
testarPredicado("podeRecusarOrcamento", podeRecusarOrcamento, ["rascunho", "enviado", "followup"]);
testarPredicado("podeMarcarServicoRealizado", podeMarcarServicoRealizado, ["aceite"]);
testarPredicado("podeMarcarFaturado", podeMarcarFaturado, ["servico_realizado"]);

// Cancelar é a válvula de escape até estar mesmo terminal — testado à
// parte porque a lista de "verdadeiro" é o complemento dos terminais, não
// uma lista curta explícita.
test("podeCancelarOrcamento: verdadeiro em qualquer estado não-terminal", () => {
  const terminais = ["faturado", "recusado", "cancelado"];
  for (const estado of ESTADOS_ORCAMENTO) {
    const esperado = !terminais.includes(estado);
    assert.equal(podeCancelarOrcamento({ estado }), esperado);
  }
});

// A app nunca deve conseguir saltar "aceite" diretamente para "faturado"
// — é exatamente a regra que a migração 005 também passou a impor na
// base de dados (VULN-01).
test("nunca existe um caminho de aceite direto para faturado sem passar por servico_realizado", () => {
  assert.equal(podeMarcarFaturado({ estado: "aceite" }), false);
});
