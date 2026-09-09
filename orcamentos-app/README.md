# Orçamentos — app standalone para micro-empresas

App independente (Next.js 15, dentro deste repo apenas por conveniência de
branch — pode ser extraído para um repo próprio sem alterações) para criar
e acompanhar orçamentos: 3 páginas principais (Orçamentos, Follow-up,
Dashboard) + Empresa (logo, dados, condições padrão).

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
independente do Next.js na raiz. Para o publicar:

1. Criar um **novo projeto Vercel** (não usar o projeto existente do Serv).
2. Ligar ao mesmo repositório GitHub, mas definir **Root Directory** =
   `orcamentos-app`.
3. Configurar as 3 env vars da secção 2 no projeto Vercel.
4. Depois de ter um domínio/URL real, atualizar
   `components/tareo/produtos-data.ts` (no repo principal) com o `href`
   deste produto, se for essa a intenção.

## Estrutura

```
app/login, app/signup          autenticação (Supabase Auth, email+password)
app/(app)/dashboard            KPIs + gráfico últimos 6 meses
app/(app)/orcamentos           lista com filtros + detalhe/edição + PDF
app/(app)/follow-up            orçamentos enviados/à espera, ações rápidas
app/(app)/empresa              logo, dados da empresa, condições padrão
lib/orcamento-estado.ts        regras de transição de estado (fonte única)
lib/orcamento.ts               cálculo de subtotal/IVA/total
lib/pdf-logo.ts                embutir logo no PDF
supabase/schema.sql            schema + RLS + bucket "logos"
```

## Limitações conhecidas

- Sem testes automatizados.
- PDF de uma página só (orçamentos muito longos ficam truncados) — mesma
  limitação aceite no módulo equivalente do Serv.
- Nunca testado ponta-a-ponta com um projeto Supabase real (sem acesso a
  criar um a partir desta sessão) — validar login/signup/upload de
  logo/PDF manualmente antes de considerar isto pronto para uso real.
