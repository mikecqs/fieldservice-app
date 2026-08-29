# FieldService — aplicação real (Next.js + Supabase)

Esqueleto funcional multi-empresa (SaaS), com autenticação real e permissões
aplicadas na base de dados, não só na interface.

## O que já está feito e a funcionar

- **Autenticação real** via Supabase Auth (login por email/password).
- **4 papéis com acesso separado ao nível do servidor** (`requireRole()` nos
  layouts + RLS): `SUPER_ADMIN`, `ADMIN`, `TECHNICIAN`, `FINANCE`.
- **Super Admin** (`/super-admin`): criar empresas novas e o primeiro Admin
  de cada uma.
- **Admin** (`/admin/*`): dashboard com números reais, e módulo de
  **Clientes** completo (listar, criar, ver detalhe com histórico) — este é
  o padrão de referência para os restantes módulos.
- **Técnico** (`/tecnico/*`): agenda com os serviços atribuídos, iniciar
  serviço, e terminar com "Concluído" / "Precisa de nova visita" / "Não foi
  possível realizar" — tudo através de funções seguras (RPC) que nunca dão
  ao técnico acesso de escrita direto às tabelas administrativas.
- **`supabase/schema.sql`**: esquema completo (todas as tabelas do briefing:
  clientes, pedidos, orçamentos, serviços, visitas, materiais, compras,
  faturação) com RLS multi-tenant e a view segura para técnicos.

## O que falta portar (mesmo padrão, por construir a seguir)

Pedidos, Agenda (vista de calendário), Serviços (detalhe admin com
agendamento e faturação), Orçamentos (com itens e cálculo de IVA),
Materiais, Compras, Faturação, Relatórios, Utilizadores, Configurações —
todos seguem exactamente o padrão do módulo Clientes: uma `page.tsx` como
Server Component a fazer `supabase.from(...).select(...)`, e um
`actions.ts` com Server Actions para escrita. Como o schema e a RLS já
existem para todas estas tabelas, portar cada módulo é sobretudo repetir
este padrão.

## Como pôr a correr

### 1. Base de dados

1. Abre o teu projeto em [supabase.com](https://supabase.com).
2. Menu **SQL Editor** → **New query**.
3. Copia todo o conteúdo de `supabase/schema.sql` para lá e corre (**Run**).
4. Confirma em **Database → Tables** que todas as tabelas foram criadas.

### 2. O teu utilizador Super Admin

1. **Authentication → Users → Add user** — cria o teu login (email + password).
2. Copia o **User UID** que aparece.
3. Volta ao **SQL Editor** e corre (substitui os valores):

   ```sql
   insert into profiles (id, organization_id, role, nome, email)
   values ('COLA-AQUI-O-UUID', null, 'SUPER_ADMIN', 'O Teu Nome', 'o-teu-email@exemplo.pt');
   ```

### 3. Variáveis de ambiente

1. Copia `.env.local.example` para `.env.local`.
2. Em **Project Settings → API** no Supabase, copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (esta é secreta —
     nunca a exponhas no código do browser nem a partilhes)

### 4. Correr localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` → entra com o teu login de Super Admin →
`/super-admin` → cria a primeira empresa → cria o Admin dessa empresa →
sai (Sair) → entra com esse login de Admin para testares o fluxo normal.

### 5. Deploy (Vercel)

1. Sobe este projeto para um repositório Git (GitHub/GitLab).
2. Em [vercel.com](https://vercel.com) → **New Project** → importa o
   repositório.
3. Adiciona as mesmas 3 variáveis de ambiente do `.env.local` nas
   definições do projeto Vercel (**Settings → Environment Variables**).
4. Deploy.

## Sobre a arquitetura de acessos (resumo)

- **Middleware** (`middleware.ts`): corre no servidor antes de qualquer
  página, mas só verifica se existe sessão (cookie) — redireciona para
  `/login` quem não tem sessão nenhuma. A validação real da role de cada
  utilizador é feita por `requireRole()` (`lib/auth.ts`), chamada nos
  `layout.tsx` de `/admin`, `/tecnico`, `/super-admin` e `/financeiro`, que
  correm em Node.js normal e confirmam a role em `profiles` antes de
  deixar passar.
- **RLS** (dentro do `schema.sql`): mesmo que o middleware falhasse, a
  própria base de dados recusa devolver ou aceitar dados fora do que cada
  papel pode ver. É a barreira que conta a sério.
- **View para técnicos** (`services_technician_view` e afins): o técnico
  nunca lê a tabela `services` diretamente — só uma vista com as colunas
  necessárias para o trabalho no terreno (sem valor, sem faturação, sem
  margens).
- **Funções RPC para o técnico** (`tech_start_service`,
  `tech_finish_visit`): o técnico não tem `UPDATE` na tabela `services` —
  só estas duas funções, muito específicas, com as suas próprias validações,
  conseguem mudar o estado de um serviço, e só do serviço que lhe está
  atribuído.
- **Não há nenhum "modo de visualização"** que troque entre Admin e Técnico
  na aplicação real — isso existiu só no protótipo em Artifact para
  demonstração. Aqui, o papel vem sempre da sessão autenticada.
