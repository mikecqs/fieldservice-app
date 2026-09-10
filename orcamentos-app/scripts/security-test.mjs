// Testes de segurança de integração — provam contra um projeto Supabase
// REAL que os ataques descritos na auditoria (VULN-01: contornar a app e
// falar diretamente com a API do Supabase) agora falham depois da
// migração 005_state_machine_enforcement.sql.
//
// Mesmo estilo do scripts/smoke-test.mjs já existente (fetch cru à REST
// API, sem SDK, sem framework de testes) — corre só via
// `npm run test:security`, manual (workflow_dispatch), nunca em produção.
// Precisa de 004 e 005 já aplicadas no projeto Supabase alvo.
//
// Cria as suas próprias empresas de teste (Empresa A / Empresa B) e limpa
// tudo no fim, sucesso ou falha.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error("Faltam env vars: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

let falhas = 0;
const usuariosParaLimpar = [];

function ok(mensagem) {
  console.log(`OK   - ${mensagem}`);
}
function erro(mensagem) {
  falhas += 1;
  console.error(`FAIL - ${mensagem}`);
}
function aviso(mensagem) {
  console.log(`WARN - ${mensagem}`);
}

async function rest(path, { method = "GET", token = anonKey, body, prefer } = {}) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await resp.text();
  let corpo;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }
  return { status: resp.status, ok: resp.ok, corpo };
}

// Assume "Confirm email" desligado no projeto de teste (como o
// smoke-test.mjs já assume) — se estiver ligado, o script para e avisa,
// sem falhar tudo com erros confusos.
async function criarUtilizadorDeTeste(label) {
  const email = `security-test-${label}-${Date.now()}@mailinator.com`;
  const password = `Teste-${Math.random().toString(36).slice(2)}!9Aa`;

  const respSignup = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const corpoSignup = await respSignup.json();
  if (!respSignup.ok) {
    throw new Error(`signup de teste (${label}) falhou: ${JSON.stringify(corpoSignup)}`);
  }

  const userId = corpoSignup.user?.id ?? corpoSignup.id;
  const accessToken = corpoSignup.access_token;
  if (!accessToken) {
    throw new Error(
      "signup não devolveu sessão imediata — 'Confirm email' parece estar ativo neste projeto; " +
        "desligue-o temporariamente (Authentication → Providers → Email) para correr este script."
    );
  }

  usuariosParaLimpar.push(userId);

  const { corpo: empresas } = await rest("companies", {
    method: "POST",
    token: accessToken,
    prefer: "return=representation",
    body: { nome: `Empresa de teste ${label}`, user_id: userId },
  });
  const companyId = Array.isArray(empresas) ? empresas[0]?.id : empresas?.id;
  if (!companyId) {
    throw new Error(`não foi possível criar a empresa de teste ${label}: ${JSON.stringify(empresas)}`);
  }

  return { email, userId, accessToken, companyId };
}

async function limparUtilizadoresDeTeste() {
  for (const userId of usuariosParaLimpar) {
    const resp = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (resp.ok) {
      ok(`utilizador de teste removido (cascade limpou empresa/dados): ${userId}`);
    } else {
      erro(`não foi possível remover o utilizador de teste ${userId} (status ${resp.status}) — remover manualmente.`);
    }
  }
}

async function main() {
  console.log("A criar duas empresas de teste (A e B)...\n");
  const empresaA = await criarUtilizadorDeTeste("a");
  const empresaB = await criarUtilizadorDeTeste("b");

  // ---------------------------------------------------------------------
  // 1. Cross-tenant isolation
  // ---------------------------------------------------------------------
  console.log("\n-- Cross-tenant isolation --");

  const { corpo: clienteA } = await rest("clients", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { company_id: empresaA.companyId, nome: "Cliente da Empresa A" },
  });
  const clientIdA = Array.isArray(clienteA) ? clienteA[0]?.id : clienteA?.id;

  const { corpo: budgetA } = await rest("budgets", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { company_id: empresaA.companyId, client_id: clientIdA },
  });
  const budgetIdA = Array.isArray(budgetA) ? budgetA[0]?.id : budgetA?.id;
  if (!budgetIdA) throw new Error(`não foi possível criar orçamento de teste da Empresa A: ${JSON.stringify(budgetA)}`);
  ok(`orçamento de teste da Empresa A criado (${budgetIdA})`);

  const leituraCruzada = await rest(`budgets?id=eq.${budgetIdA}`, { token: empresaB.accessToken });
  if (leituraCruzada.ok && Array.isArray(leituraCruzada.corpo) && leituraCruzada.corpo.length === 0) {
    ok("Empresa B não consegue LER o orçamento da Empresa A (RLS)");
  } else {
    erro(`Empresa B conseguiu ler dados da Empresa A: ${JSON.stringify(leituraCruzada.corpo)}`);
  }

  const escritaCruzada = await rest(`budgets?id=eq.${budgetIdA}`, {
    method: "PATCH",
    token: empresaB.accessToken,
    body: { notas: "escrito pela empresa errada" },
  });
  const escritaCruzadaAfetouLinhas = Array.isArray(escritaCruzada.corpo) && escritaCruzada.corpo.length > 0;
  if (!escritaCruzadaAfetouLinhas) {
    ok("Empresa B não consegue EDITAR o orçamento da Empresa A (RLS)");
  } else {
    erro(`Empresa B conseguiu editar o orçamento da Empresa A: ${JSON.stringify(escritaCruzada.corpo)}`);
  }

  const leituraClientesCruzada = await rest(`clients?company_id=eq.${empresaA.companyId}`, {
    token: empresaB.accessToken,
  });
  if (leituraClientesCruzada.ok && Array.isArray(leituraClientesCruzada.corpo) && leituraClientesCruzada.corpo.length === 0) {
    ok("Empresa B não consegue ler clientes da Empresa A (RLS)");
  } else {
    erro(`Empresa B conseguiu ler clientes da Empresa A: ${JSON.stringify(leituraClientesCruzada.corpo)}`);
  }

  const leituraEventosCruzada = await rest(`budget_events?budget_id=eq.${budgetIdA}`, { token: empresaB.accessToken });
  if (leituraEventosCruzada.ok && Array.isArray(leituraEventosCruzada.corpo) && leituraEventosCruzada.corpo.length === 0) {
    ok("Empresa B não consegue ler budget_events da Empresa A (RLS)");
  } else {
    erro(`Empresa B conseguiu ler eventos da Empresa A: ${JSON.stringify(leituraEventosCruzada.corpo)}`);
  }

  // ---------------------------------------------------------------------
  // 2. State machine — transições inválidas diretas à API
  // ---------------------------------------------------------------------
  console.log("\n-- State machine (trigger enforce_budget_transition) --");

  async function tentarTransicao(descricao, estadoDestino, extra = {}) {
    const resultado = await rest(`budgets?id=eq.${budgetIdA}`, {
      method: "PATCH",
      token: empresaA.accessToken,
      body: { estado: estadoDestino, ...extra },
    });
    const linhasAfetadas = Array.isArray(resultado.corpo) ? resultado.corpo.length : 0;
    if (linhasAfetadas === 0) {
      ok(`${descricao} — bloqueado corretamente`);
      return false;
    }
    erro(`${descricao} — DEVERIA TER FALHADO e foi aceite: ${JSON.stringify(resultado.corpo)}`);
    return true;
  }

  await tentarTransicao("rascunho → faturado (salto direto, sem passar pelos estados intermédios)", "faturado");
  await tentarTransicao("rascunho → servico_realizado (salto direto)", "servico_realizado");

  // Avança legitimamente por PATCH direto (simula o que a app faz) para
  // preparar os testes de imutabilidade abaixo — usa o mesmo caminho que
  // as Server Actions usam (update simples), só para chegar a "faturado".
  await rest(`budgets?id=eq.${budgetIdA}`, { method: "PATCH", token: empresaA.accessToken, body: { estado: "aceite" } });
  await rest(`budgets?id=eq.${budgetIdA}`, {
    method: "PATCH",
    token: empresaA.accessToken,
    body: { estado: "servico_realizado" },
  });
  await rest(`budgets?id=eq.${budgetIdA}`, { method: "PATCH", token: empresaA.accessToken, body: { estado: "faturado" } });

  const { corpo: verificacaoEstado } = await rest(`budgets?id=eq.${budgetIdA}&select=estado`, {
    token: empresaA.accessToken,
  });
  const estadoAtual = Array.isArray(verificacaoEstado) ? verificacaoEstado[0]?.estado : undefined;
  if (estadoAtual === "faturado") {
    ok("sequência válida rascunho → aceite → servico_realizado → faturado foi aceite (não ficou tudo bloqueado)");
  } else {
    erro(`orçamento não chegou a 'faturado' pela sequência válida — estado atual: ${estadoAtual}`);
  }

  await tentarTransicao("faturado → rascunho (regressão de estado terminal)", "rascunho");
  await tentarTransicao("faturado → enviado (alteração depois de terminal)", "enviado");

  // ---------------------------------------------------------------------
  // 3. Immutability — budget faturado
  // ---------------------------------------------------------------------
  console.log("\n-- Immutability depois de faturado --");

  const updateIvaFaturado = await rest(`budgets?id=eq.${budgetIdA}`, {
    method: "PATCH",
    token: empresaA.accessToken,
    body: { iva_percent: 0 },
  });
  if (!Array.isArray(updateIvaFaturado.corpo) || updateIvaFaturado.corpo.length === 0) {
    ok("UPDATE de iva_percent num orçamento faturado — bloqueado");
  } else {
    erro(`iva_percent foi alterado num orçamento faturado: ${JSON.stringify(updateIvaFaturado.corpo)}`);
  }

  const updateNotasFaturado = await rest(`budgets?id=eq.${budgetIdA}`, {
    method: "PATCH",
    token: empresaA.accessToken,
    body: { notas: "tentativa depois de faturado" },
  });
  if (!Array.isArray(updateNotasFaturado.corpo) || updateNotasFaturado.corpo.length === 0) {
    ok("UPDATE de qualquer coluna (notas) num orçamento faturado — bloqueado (linha congelada)");
  } else {
    erro(`notas foram alteradas num orçamento faturado: ${JSON.stringify(updateNotasFaturado.corpo)}`);
  }

  const insertItemFaturado = await rest("budget_items", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { budget_id: budgetIdA, descricao: "item forjado", quantidade: 1, valor_unitario: 999 },
  });
  if (!insertItemFaturado.ok) {
    ok("INSERT de item num orçamento faturado — bloqueado");
  } else {
    erro(`item foi inserido num orçamento faturado: ${JSON.stringify(insertItemFaturado.corpo)}`);
  }

  // ---------------------------------------------------------------------
  // 4. budget_items — só editáveis em rascunho (orçamento novo, ainda rascunho)
  // ---------------------------------------------------------------------
  console.log("\n-- budget_items fora de rascunho --");

  const { corpo: budgetRascunho } = await rest("budgets", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { company_id: empresaA.companyId, client_id: clientIdA },
  });
  const budgetIdRascunho = Array.isArray(budgetRascunho) ? budgetRascunho[0]?.id : budgetRascunho?.id;

  const insertEmRascunho = await rest("budget_items", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { budget_id: budgetIdRascunho, descricao: "item válido", quantidade: 1, valor_unitario: 10 },
  });
  const itemId = Array.isArray(insertEmRascunho.corpo) ? insertEmRascunho.corpo[0]?.id : undefined;
  if (insertEmRascunho.ok && itemId) {
    ok("INSERT de item num orçamento em rascunho — permitido, como esperado");
  } else {
    erro(`insert de item em rascunho devia ter sido aceite: ${JSON.stringify(insertEmRascunho.corpo)}`);
  }

  await rest(`budgets?id=eq.${budgetIdRascunho}`, { method: "PATCH", token: empresaA.accessToken, body: { estado: "aceite" } });

  const insertForaDeRascunho = await rest("budget_items", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { budget_id: budgetIdRascunho, descricao: "item ilegítimo", quantidade: 1, valor_unitario: 1 },
  });
  if (!insertForaDeRascunho.ok) {
    ok("INSERT de item fora de rascunho (estado 'aceite') — bloqueado");
  } else {
    erro(`item foi inserido fora de rascunho: ${JSON.stringify(insertForaDeRascunho.corpo)}`);
  }

  const deleteForaDeRascunho = await rest(`budget_items?id=eq.${itemId}`, {
    method: "DELETE",
    token: empresaA.accessToken,
    prefer: "return=representation",
  });
  if (!Array.isArray(deleteForaDeRascunho.corpo) || deleteForaDeRascunho.corpo.length === 0) {
    ok("DELETE de item fora de rascunho — bloqueado");
  } else {
    erro(`item foi apagado fora de rascunho: ${JSON.stringify(deleteForaDeRascunho.corpo)}`);
  }

  // ---------------------------------------------------------------------
  // 5. budget_events — não forjável por insert direto
  // ---------------------------------------------------------------------
  console.log("\n-- budget_events (audit trail) --");

  const forjarEvento = await rest("budget_events", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { budget_id: budgetIdA, tipo: "aceite", descricao: "evento forjado, nunca aconteceu" },
  });
  if (!forjarEvento.ok) {
    ok("INSERT direto em budget_events — bloqueado (RLS sem policy de insert)");
  } else {
    erro(`foi possível forjar um evento de auditoria: ${JSON.stringify(forjarEvento.corpo)}`);
  }

  const { corpo: eventosGerados } = await rest(`budget_events?budget_id=eq.${budgetIdA}&order=created_at.asc`, {
    token: empresaA.accessToken,
  });
  const tiposGerados = Array.isArray(eventosGerados) ? eventosGerados.map((e) => e.tipo) : [];
  const esperados = ["criado", "aceite", "servico_realizado", "faturado"];
  const todosPresentes = esperados.every((t) => tiposGerados.includes(t));
  if (todosPresentes) {
    ok(`eventos gerados automaticamente pelos triggers correspondem às transições reais: [${tiposGerados.join(", ")}]`);
  } else {
    erro(`eventos automáticos incompletos/incorretos: [${tiposGerados.join(", ")}], esperava incluir [${esperados.join(", ")}]`);
  }

  // ---------------------------------------------------------------------
  // 6. budget_templates — limite de 3, incluindo concorrência
  // ---------------------------------------------------------------------
  console.log("\n-- budget_templates limite de 3 (com concorrência) --");

  for (let i = 1; i <= 3; i++) {
    const r = await rest("budget_templates", {
      method: "POST",
      token: empresaA.accessToken,
      prefer: "return=representation",
      body: { company_id: empresaA.companyId, nome: `Modelo ${i}` },
    });
    if (!r.ok) erro(`falha inesperada a criar o modelo ${i}/3: ${JSON.stringify(r.corpo)}`);
  }

  const quartoSequencial = await rest("budget_templates", {
    method: "POST",
    token: empresaA.accessToken,
    prefer: "return=representation",
    body: { company_id: empresaA.companyId, nome: "Modelo 4 (a mais)" },
  });
  if (!quartoSequencial.ok) {
    ok("criar um 4º modelo sequencialmente — bloqueado pelo trigger de limite");
  } else {
    erro(`4º modelo foi criado, limite de 3 não foi respeitado: ${JSON.stringify(quartoSequencial.corpo)}`);
  }

  // Concorrência: dispara duas tentativas de "5º modelo" em paralelo a
  // partir de 3 já existentes — só uma pode passar (a outra tem de ser
  // travada pelo lock da linha de companies no trigger), nunca as duas.
  await rest(`budget_templates?company_id=eq.${empresaA.companyId}&order=created_at.desc&limit=1`, {
    method: "DELETE",
    token: empresaA.accessToken,
  });
  const [concorrente1, concorrente2] = await Promise.all([
    rest("budget_templates", {
      method: "POST",
      token: empresaA.accessToken,
      prefer: "return=representation",
      body: { company_id: empresaA.companyId, nome: "Concorrente 1" },
    }),
    rest("budget_templates", {
      method: "POST",
      token: empresaA.accessToken,
      prefer: "return=representation",
      body: { company_id: empresaA.companyId, nome: "Concorrente 2" },
    }),
  ]);
  const sucessos = [concorrente1, concorrente2].filter((r) => r.ok).length;
  if (sucessos === 1) {
    ok("dois inserts concorrentes no limite — só um passou (lock evitou o race condition)");
  } else {
    erro(`dois inserts concorrentes no limite deviam resultar em exatamente 1 sucesso, resultou em ${sucessos}`);
  }

  // ---------------------------------------------------------------------
  // Limpeza
  // ---------------------------------------------------------------------
  console.log("\n-- Limpeza --");
  await limparUtilizadoresDeTeste();

  console.log(`\nResumo: ${falhas === 0 ? "todas as verificações de segurança passaram" : `${falhas} verificação(ões) falharam`}.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro inesperado no teste de segurança:", e);
  await limparUtilizadoresDeTeste().catch(() => {});
  process.exit(1);
});
