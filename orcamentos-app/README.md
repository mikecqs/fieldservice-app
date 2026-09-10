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
de aceite direto para faturado.

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

Migração mais recente: `004_servico_realizado_faturado.sql` — acrescenta
os estados `servico_realizado` e `faturado` ao `CHECK` de `budgets.estado`
e `budget_events.tipo`. Necessária para quem já tinha o schema anterior
(sem estes dois estados) em produção.

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
app/(app)/dashboard            KPIs + gráfico últimos 6 meses
app/(app)/orcamentos           lista com filtros + detalhe/edição + PDF
app/(app)/follow-up            orçamentos enviados/à espera, ações rápidas
app/(app)/empresa              logo, dados da empresa, condições padrão,
                                até 3 modelos de orçamento reutilizáveis
lib/orcamento-estado.ts        regras de transição de estado (fonte única)
lib/orcamento.ts               cálculo de subtotal/IVA/total
lib/pdf-logo.ts                embutir logo no PDF
supabase/schema.sql            schema + RLS + bucket "logos" (fonte de
                                verdade para uma instalação nova)
supabase/migrations/           alterações incrementais para quem já tem
                                o projeto Supabase criado (ver secção 1.1)
```

## Limitações conhecidas

- Sem testes automatizados.
- PDF de uma página só (orçamentos muito longos ficam truncados) — mesma
  limitação aceite no módulo equivalente do Serv.
- Testado ponta-a-ponta em produção (Supabase + Vercel reais): signup,
  login, criar/editar orçamento, PDF, logo — todos confirmados a
  funcionar.
