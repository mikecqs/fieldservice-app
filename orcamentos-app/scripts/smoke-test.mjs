// Smoke test manual (não faz parte da app, não corre em produção) — valida
// que o schema.sql foi aplicado no projeto Supabase real e que a policy de
// RLS de `companies` deixa o próprio utilizador criar/ler a sua empresa.
// Corre só a partir do workflow orcamentos-supabase-smoke-test.yml
// (workflow_dispatch manual), porque este sandbox de desenvolvimento não
// tem acesso de rede a domínios externos.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error("Faltam env vars: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

let falhas = 0;

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

async function main() {
  // 1. Schema aplicado: com a anon key (sem sessão), RLS filtra tudo, mas a
  // tabela tem de existir — 200 com [] é o resultado esperado.
  const respSchema = await fetch(`${url}/rest/v1/companies?select=id&limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (respSchema.status === 200) {
    const corpo = await respSchema.json();
    if (Array.isArray(corpo) && corpo.length === 0) {
      ok("schema aplicado — tabela companies existe e RLS filtra o acesso anónimo");
    } else {
      erro(`companies devolveu dados inesperados para acesso anónimo: ${JSON.stringify(corpo)}`);
    }
  } else {
    erro(`GET /rest/v1/companies devolveu ${respSchema.status} — schema.sql provavelmente não foi corrido. Corpo: ${await respSchema.text()}`);
    console.log("\nResumo: 1 verificação falhou, restantes ignoradas (dependem do schema existir).");
    process.exit(1);
  }

  // 2. Bucket de storage "logos"
  const respBucket = await fetch(`${url}/storage/v1/bucket/logos`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (respBucket.status === 200) {
    ok("bucket de storage 'logos' existe");
  } else {
    erro(`bucket 'logos' não encontrado (status ${respBucket.status})`);
  }

  // 3. Signup de um utilizador descartável
  const emailTeste = `smoke-test-${Date.now()}@example.com`;
  const passwordTeste = `Teste-${Math.random().toString(36).slice(2)}!9`;

  const respSignup = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailTeste, password: passwordTeste }),
  });
  const corpoSignup = await respSignup.json();

  if (!respSignup.ok) {
    erro(`signup falhou (status ${respSignup.status}): ${JSON.stringify(corpoSignup)}`);
    process.exit(1);
  }

  const userId = corpoSignup.user?.id ?? corpoSignup.id;
  const accessToken = corpoSignup.access_token;

  if (!accessToken) {
    aviso("signup criou o utilizador mas sem sessão imediata — confirmação de email está ativa neste projeto. Isto é normal, não é um erro; só significa que não dá para testar o insert de RLS sem confirmar o email primeiro.");
  } else {
    ok(`signup de teste criado (${emailTeste}) com sessão imediata`);

    // 4. Insert de companies via RLS (com o token do próprio utilizador)
    const respInsert = await fetch(`${url}/rest/v1/companies`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ nome: "Empresa smoke-test", user_id: userId }),
    });

    if (respInsert.ok) {
      ok("RLS permite ao próprio utilizador criar a sua empresa (insert em companies)");

      // 5. Select de volta
      const respSelect = await fetch(`${url}/rest/v1/companies?select=nome`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      });
      const corpoSelect = await respSelect.json();
      if (respSelect.ok && Array.isArray(corpoSelect) && corpoSelect.length === 1) {
        ok("RLS permite ao próprio utilizador ler a sua empresa (select em companies)");
      } else {
        erro(`select pós-insert devolveu resultado inesperado: ${JSON.stringify(corpoSelect)}`);
      }
    } else {
      erro(`insert em companies falhou (status ${respInsert.status}): ${await respInsert.text()}`);
    }
  }

  // 6. Limpeza: apagar o utilizador de teste (cascade apaga a empresa)
  if (userId) {
    const respDelete = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (respDelete.ok) {
      ok("utilizador de teste removido (cascade limpou a empresa de teste)");
    } else {
      erro(`não foi possível remover o utilizador de teste (status ${respDelete.status}) — remover manualmente: ${emailTeste}`);
    }
  }

  console.log(`\nResumo: ${falhas === 0 ? "todas as verificações passaram" : `${falhas} verificação(ões) falharam`}.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Erro inesperado no smoke test:", e);
  process.exit(1);
});
