-- Migração para o projeto Supabase JÁ EM PRODUÇÃO do orcamentos-app.
-- Corre isto uma vez no SQL Editor — não voltes a correr o schema.sql
-- completo, as tabelas já existem e isso ia falhar/duplicar.
--
-- O que faz:
-- 1. Substitui a policy "for all" de `budgets` por select/insert/update
--    (nunca delete) — histórico de orçamentos passa a ser sempre
--    aditivo, mesmo princípio do Serv.
-- 2. Cria a tabela `budget_events` (histórico do percurso de cada
--    orçamento), com RLS só de select/insert (nunca update/delete).
--
-- Idempotente: pode ser corrido mais do que uma vez sem partir nada.

-- 1. Hardening de budgets ----------------------------------------------------
drop policy if exists "user manages own budgets" on budgets;
drop policy if exists "user reads own budgets" on budgets;
drop policy if exists "user inserts own budgets" on budgets;
drop policy if exists "user updates own budgets" on budgets;

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

-- 2. budget_events ------------------------------------------------------------
create table if not exists budget_events (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets (id) on delete cascade,
  tipo text not null
    check (tipo in ('criado', 'enviado', 'followup', 'aceite', 'recusado', 'cancelado', 'duplicado')),
  descricao text not null,
  created_at timestamptz not null default now()
);

create index if not exists budget_events_budget_id_idx on budget_events (budget_id);

alter table budget_events enable row level security;

drop policy if exists "user reads own budget events" on budget_events;
drop policy if exists "user inserts own budget events" on budget_events;

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
