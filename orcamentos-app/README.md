# Orçamentos — app standalone para micro-empresas

App independente (Next.js 15, dentro deste repo apenas por conveniência de
branch — pode ser extraído para um repo próprio sem alterações) para criar
e acompanhar orçamentos: 3 páginas principais (Orçamentos, Follow-up,
Dashboard) + Empresa (logo, dados, condições padrão, até 3 modelos de
orçamento reutilizáveis). Por orçamento: duplicar, partilhar por
WhatsApp/email, histórico de eventos
(criado/enviado/follow-up/aceite/recusado/cancelado/duplicado), e
opção de partir de um modelo ao criar. Marcar como enviado agenda o
follow-up automaticamente (dias configuráveis em Empresa).

Depois de aceite, o orçamento só fica mesmo concluído ao ser marcado
"Faturado" — passa primeiro por "Serviço realizado" (ambos os botões
aparecem na ficha do orçamento, tal como "Marcar enviado"); nunca salta
de aceite direto para faturado. Esta regra (e as restantes transições de
estado, a imutabilidade de orçamentos faturados/recusados/cancelados, e o
histórico de eventos) são impostas diretamente na base de dados via
triggers Postgres, não só pela app — ver `supabase/migrations/
005_state_machine_enforcement.sql` e a secção "Segurança" abaixo.

Recuperação de password self-service (`/esqueci-password` →
`/reset-password`, via Supabase Auth) e headers de segurança (CSP
dimensionada aos recursos reais da app) já incluídos.

Não partilha código, base de dados nem deploy com o resto do repo
(fieldservice-app/Serv). É o "Produto 02" do catálogo da Tareo
(`components/tareo/produtos-data.ts`), ainda sem `href`.

## Passos manuais necessários (fora do alcance de uma sessão Claude Code)

### 1. Criar o projeto Supabase

1. Criar um projeto novo em [supabase.com](https://supabase.com) — **não**
   reutilizar o projeto do fieldservice-app.
2. No SQL Editor, correr o ficheiro `supabase/schema.sql` completo (cria as
   tabelas `companies`/`clients`/`budgets`/`budget_items`, as respetivas
   policies de RLS, e o bucket de storage privado `logos`).
3. Em **Authentication → Providers**, confirmar que "Email" está ativo. Em
   **Authentication → Email Templates**, decidir se a confirmação de email
   fica ativa (por defeito sim — o fluxo de signup já trata os dois casos).

### 1.1 Migrações (só se o projeto Supabase já existir/estiver em produção)

Se já correste o `schema.sql` original e a app já tem contas/dados reais,
**não voltes a correr o `schema.sql` completo** (ia falhar, as tabelas já
existem). Corre em vez disso, uma única vez, os ficheiros em
`supabase/migrations/`, por ordem numérica, no SQL Editor. Cada um é
idempotente (pode ser corrido mais do que uma vez sem partir nada) e o
nome do ficheiro diz o que faz.

Se estás a criar o projeto Supabase de raiz agora, ignora isto — o
`schema.sql` já inclui tudo.

Migração mais recente: `005_state_machine_enforcement.sql` — move a
validação da máquina de estados, a imutabilidade de orçamentos
faturados/recusados/cancelados, a geração de `budget_events` e o limite
de 3 modelos de orçamento de "só na app" para "imposto pela própria base
de dados" (triggers). **Importante para quem já tem o projeto Supabase em
produção**: sem esta migração, um pedido direto à API do Supabase
(contornando a app) ainda conseguia saltar estados ou editar um orçamento
já faturado — ver auditoria de segurança referida no commit. Idempotente,
como as anteriores.

Migração anterior: `004_servico_realizado_faturado.sql` — acrescenta os
estados `servico_realizado` e `faturado` ao `CHECK` de `budgets.estado` e
`budget_events.tipo`.

### 1.2 Redirect URLs (recuperação de password)

Em **Authentication → URL Configuration** do projeto Supabase, confirmar
que `https://<domínio-do-deploy>/api/auth/confirm` está na lista de
Redirect URLs permitidas — sem isto, o link de "Esqueci-me da password"
pode falhar silenciosamente em produção (funciona em `localhost` por
omissão em muitos projetos, mas não está garantido).

### 2. Variáveis de ambiente

Copiar `.env.example` para `.env.local` e preencher com os valores do
projeto Supabase criado (Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Correr localmente

```
cd orcamentos-app
npm install
npm run dev
```

### 4. Deploy (Vercel)

Este projeto vive numa subpasta do repo `fieldservice-app`, mas é
independente do Next.js na raiz — **tem de ter o seu próprio projeto
Vercel**, nunca reutilizar/reconfigurar o projeto Vercel existente do
Serv (mudar o Root Directory desse projeto substituiria o deployment de
produção do Serv por este app, em vez de criar algo novo — já aconteceu
uma vez, corrigido revertendo o Root Directory desse projeto).

1. **Add New → Project** no Vercel, ligado ao mesmo repositório GitHub,
   mas como um **projeto à parte** (nome sugerido: `orcamentos-app`,
   nunca o mesmo projeto do Serv).
   - Se a pasta `orcamentos-app` ainda não existir no branch `master` do
     repo, o assistente de criação não a vai oferecer no seletor de
     Root Directory — cria o projeto na mesma (root directory por
     omitir) e ajusta a seguir em Settings → General → Root Directory
     (esse campo aceita texto livre depois do projeto criado).
2. Definir **Root Directory** = `orcamentos-app`.
3. Configurar as 3 env vars da secção 2 no projeto Vercel — as do
   Supabase deste app, nunca as do Serv.
4. Sem alterar a Production Branch, um push a qualquer branch já gera um
   Preview Deployment automaticamente — suficiente para testar antes de
   decidir um domínio de produção definitivo.
5. Depois de ter um domínio/URL real, atualizar
   `components/tareo/produtos-data.ts` (no repo principal) com o `href`
   deste produto, se for essa a intenção.

## Estrutura

```
app/login, app/signup          autenticação (Supabase Auth, email+password)
app/esqueci-password           pedir link de recuperação de password
app/reset-password             definir nova password (a partir do link)
app/api/auth/confirm           callback dos emails do Supabase Auth (recovery)
app/(app)/dashboard            KPIs + gráfico últimos 6 meses
app/(app)/orcamentos           lista com filtros + detalhe/edição + PDF
app/(app)/follow-up            orçamentos enviados/à espera, ações rápidas
app/(app)/empresa              logo, dados da empresa, condições padrão,
                                até 3 modelos de orçamento reutilizáveis
lib/orcamento-estado.ts        regras de transição de estado (fonte única
                                a nível de app — replicada na BD, ver 1.1)
lib/orcamento.ts               cálculo de subtotal/IVA/total
lib/logo-validacao.ts          validação do logotipo por magic bytes
lib/pdf-logo.ts                embutir logo no PDF
supabase/schema.sql            schema + RLS + triggers + bucket "logos"
                                (fonte de verdade para uma instalação nova)
supabase/migrations/           alterações incrementais para quem já tem
                                o projeto Supabase criado (ver secção 1.1)
scripts/security-test.mjs      testes de integração contra um Supabase real
                                (isolamento, máquina de estados, imutabilidade)
```

## Segurança

- **Isolamento entre empresas**: RLS por `company_id` em todas as tabelas
  + verificação explícita nas Server Actions sempre que um ID vem do
  cliente (nunca confiado às cegas).
- **Máquina de estados e imutabilidade impostas na base de dados**
  (triggers, não só na app) — um orçamento faturado/recusado/cancelado
  fica congelado; itens só editáveis em rascunho; `budget_events` só é
  gerado automaticamente a partir de mudanças de estado reais, nunca
  inserível diretamente.
- **Headers de segurança** (CSP, X-Frame-Options, etc.) em
  `next.config.mjs`, dimensionados aos recursos reais da app.
- **Recuperação de password** via Supabase Auth (`/esqueci-password`).
- **Upload de logotipo** validado por assinatura real do ficheiro (magic
  bytes), não só pelo `Content-Type` declarado; limite de 2MB.

## Testes

```
npm run test:unit       # unitários (máquina de estados, validação de upload) — sem rede
npm run test:security   # integração contra um Supabase real — precisa de
                         # SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY
                         # e da migração 005 já aplicada
```

O workflow `orcamentos-supabase-smoke-test.yml` (manual, `workflow_dispatch`)
corre os dois, mais o smoke test original de schema/RLS/storage.

## Limitações conhecidas

- Sem rate limiting aplicacional (login/signup/PDF) — decisão deliberada
  por agora (Supabase Auth já limita os seus próprios endpoints); ver
  raciocínio no relatório de implementação de segurança.
- Sem MFA — Supabase Auth suporta, mas não está exposto na UI.
- PDF de uma página só (orçamentos muito longos ficam truncados) — mesma
  limitação aceite no módulo equivalente do Serv.
- Sem testes de browser/UI (só unitários + integração via API).
- Testado ponta-a-ponta em produção (Supabase + Vercel reais): signup,
  login, criar/editar orçamento, PDF, logo — todos confirmados a
  funcionar. O fluxo de recuperação de password e a migração 005 ainda
  não foram testados contra o projeto Supabase de produção — ver secção
  1.1/1.2 acima.
