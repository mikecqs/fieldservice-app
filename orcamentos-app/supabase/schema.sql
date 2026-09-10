-- Schema do app "Orçamentos" para micro-empresas.
-- Projeto Supabase próprio e isolado (não é o Supabase do fieldservice-app/Serv).
-- Correr este ficheiro completo no SQL Editor de um projeto Supabase novo.
--
-- Modelo: 1 conta (auth.users) = 1 empresa (companies). Sem roles/equipas —
-- cada utilizador só vê e gere os seus próprios dados (RLS por company).

-- ---------------------------------------------------------------------------
-- 1. companies
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nome text not null,
  nif text,
  endereco text,
  telefone text,
  email text,
  logo_path text,
  condicoes_padrao text,
  followup_dias_padrao integer not null default 7,
  created_at timestamptz not null default now()
);

alter table companies enable row level security;

create policy "user manages own company"
  on companies for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Helper: id da empresa do utilizador autenticado (usado nas policies abaixo).
create function my_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from companies where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. clients
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  nome text not null,
  empresa text,
  telefone text,
  email text,
  morada text,
  nif text,
  created_at timestamptz not null default now()
);

create index clients_company_id_idx on clients (company_id);

alter table clients enable row level security;

create policy "user manages own clients"
  on clients for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- ---------------------------------------------------------------------------
-- 3. budgets (orçamentos)
-- ---------------------------------------------------------------------------
create sequence budgets_numero_seq;

create table budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  client_id uuid not null references clients (id) on delete restrict,
  numero text not null unique default (
    'ORC-' || lpad(nextval('budgets_numero_seq')::text, 6, '0')
  ),
  estado text not null default 'rascunho'
    check (estado in ('rascunho', 'enviado', 'followup', 'aceite', 'recusado', 'cancelado')),
  condicoes text,
  iva_percent numeric not null default 23,
  validade_dias integer not null default 30,
  notas text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  followup_em date,
  updated_at timestamptz not null default now()
);

create index budgets_company_id_idx on budgets (company_id);
create index budgets_client_id_idx on budgets (client_id);
create index budgets_estado_idx on budgets (estado);
create index budgets_followup_em_idx on budgets (followup_em);

alter table budgets enable row level security;

-- select/insert/update, nunca delete — histórico de orçamentos é sempre
-- aditivo (mesmo princípio do Serv: um orçamento aceite/recusado/cancelado
-- nunca desaparece). Itens (abaixo) continuam livremente apagáveis
-- enquanto o orçamento está em rascunho — só o registo do orçamento em si
-- é que nunca é eliminado.
create policy "user reads own budgets"
  on budgets for select
  using (company_id = my_company_id());

create policy "user inserts own budgets"
  on budgets for insert
  with check (company_id = my_company_id());

create policy "user updates own budgets"
  on budgets for update
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- ---------------------------------------------------------------------------
-- 4. budget_items
-- ---------------------------------------------------------------------------
create table budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets (id) on delete cascade,
  descricao text not null,
  quantidade numeric not null default 1,
  valor_unitario numeric not null default 0,
  ordem integer not null default 0
);

create index budget_items_budget_id_idx on budget_items (budget_id);

alter table budget_items enable row level security;

create policy "user manages own budget items"
  on budget_items for all
  using (
    budget_id in (select id from budgets where company_id = my_company_id())
  )
  with check (
    budget_id in (select id from budgets where company_id = my_company_id())
  );

-- ---------------------------------------------------------------------------
-- 5. budget_events (histórico do percurso de cada orçamento)
-- ---------------------------------------------------------------------------
create table budget_events (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets (id) on delete cascade,
  tipo text not null
    check (tipo in ('criado', 'enviado', 'followup', 'aceite', 'recusado', 'cancelado', 'duplicado')),
  descricao text not null,
  created_at timestamptz not null default now()
);

create index budget_events_budget_id_idx on budget_events (budget_id);

alter table budget_events enable row level security;

-- Só select/insert — nunca update/delete. É um registo histórico, tem de
-- ficar imutável mesmo que o orçamento associado mude de estado depois.
create policy "user reads own budget events"
  on budget_events for select
  using (
    budget_id in (select id from budgets where company_id = my_company_id())
  );

create policy "user inserts own budget events"
  on budget_events for insert
  with check (
    budget_id in (select id from budgets where company_id = my_company_id())
  );

-- ---------------------------------------------------------------------------
-- 6. budget_templates (modelos base — até 3 por empresa, limite aplicado
--    na Server Action, não aqui)
-- ---------------------------------------------------------------------------
create table budget_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  nome text not null,
  condicoes text,
  iva_percent numeric not null default 23,
  validade_dias integer not null default 30,
  created_at timestamptz not null default now()
);

create index budget_templates_company_id_idx on budget_templates (company_id);

alter table budget_templates enable row level security;

-- Configuração, não histórico — pode ser livremente editado/apagado
-- (ao contrário de `budgets`, que nunca é apagável).
create policy "user manages own budget templates"
  on budget_templates for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

create table budget_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references budget_templates (id) on delete cascade,
  descricao text not null,
  quantidade numeric not null default 1,
  valor_unitario numeric not null default 0,
  ordem integer not null default 0
);

create index budget_template_items_template_id_idx on budget_template_items (template_id);

alter table budget_template_items enable row level security;

create policy "user manages own budget template items"
  on budget_template_items for all
  using (
    template_id in (select id from budget_templates where company_id = my_company_id())
  )
  with check (
    template_id in (select id from budget_templates where company_id = my_company_id())
  );

-- ---------------------------------------------------------------------------
-- 7. Storage: bucket privado para logos das empresas
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

-- Ficheiros guardados em "logos/{company_id}/logo.<ext>" — a pasta de topo
-- (primeiro elemento do path) tem de corresponder à empresa do utilizador.
create policy "user manages own company logo"
  on storage.objects for all
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (my_company_id())::text
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (my_company_id())::text
  );
