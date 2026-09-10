// Testes unitários puros (sem rede/Supabase) para a validação de upload
// do logotipo — VULN-06 da auditoria de segurança ("validação só por
// file.type, sem inspecionar os bytes reais"). Corre com
// `npm run test:unit` (node --test via tsx, sem framework adicional).

import assert from "node:assert/strict";
import { test } from "node:test";
import { detetarTipoImagem, TAMANHO_MAXIMO_LOGO } from "./logo-validacao";

function bytes(...valores: number[]): Uint8Array {
  return new Uint8Array(valores);
}

test("deteta um PNG válido pela assinatura completa de 8 bytes", () => {
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
  assert.equal(detetarTipoImagem(png), "png");
});

test("deteta um JPEG válido pela assinatura de 3 bytes (FF D8 FF)", () => {
  const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);
  assert.equal(detetarTipoImagem(jpeg), "jpg");
});

test("rejeita um ficheiro cujos bytes não são de PNG nem JPEG, mesmo pequeno", () => {
  const textoQualquer = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal(detetarTipoImagem(textoQualquer), null);
});

test("rejeita um SVG (começa por '<svg' ou '<?xml', nunca pelas magic bytes de raster)", () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal(detetarTipoImagem(svg), null);
});

test("rejeita um ficheiro vazio", () => {
  assert.equal(detetarTipoImagem(bytes()), null);
});

test("rejeita um ficheiro com extensão/Content-Type PNG forjado mas conteúdo diferente", () => {
  // Simula exatamente o cenário do finding: um atacante declara
  // Content-Type: image/png no upload, mas os bytes reais são de outra
  // coisa (aqui, um cabeçalho PDF) — a deteção tem de olhar para os
  // bytes, nunca para o que o pedido afirma que o ficheiro é.
  const pdfDisfarcado = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34); // "%PDF-1.4"
  assert.equal(detetarTipoImagem(pdfDisfarcado), null);
});

test("não confunde um PNG com apenas os primeiros bytes da assinatura truncados", () => {
  const truncado = bytes(0x89, 0x50, 0x4e, 0x47); // só 4 dos 8 bytes da assinatura
  assert.equal(detetarTipoImagem(truncado), null);
});

test("TAMANHO_MAXIMO_LOGO está definido e é um limite razoável (não zero, não ilimitado)", () => {
  assert.ok(TAMANHO_MAXIMO_LOGO > 0);
  assert.ok(TAMANHO_MAXIMO_LOGO <= 10 * 1024 * 1024, "limite não devia exceder 10MB para um logotipo");
});
