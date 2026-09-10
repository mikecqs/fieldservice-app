-- Migração para o projeto Supabase já em produção do orcamentos-app.
-- Corre isto uma vez no SQL Editor. Idempotente.
--
-- Cria `budget_templates` + `budget_template_items` (modelos base de
-- orçamento — até 3 por empresa, limite aplicado na Server Action).

create table if not exists budget_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  nome text not null,
  condicoes text,
  iva_percent numeric not null default 23,
  validade_dias integer not null default 30,
  created_at timestamptz not null default now()
);

create index if not exists budget_templates_company_id_idx on budget_templates (company_id);

alter table budget_templates enable row level security;

drop policy if exists "user manages own budget templates" on budget_templates;

create policy "user manages own budget templates"
  on budget_templates for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

create table if not exists budget_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references budget_templates (id) on delete cascade,
  descricao text not null,
  quantidade numeric not null default 1,
  valor_unitario numeric not null default 0,
  ordem integer not null default 0
);

create index if not exists budget_template_items_template_id_idx on budget_template_items (template_id);

alter table budget_template_items enable row level security;

drop policy if exists "user manages own budget template items" on budget_template_items;

create policy "user manages own budget template items"
  on budget_template_items for all
  using (
    template_id in (select id from budget_templates where company_id = my_company_id())
  )
  with check (
    template_id in (select id from budget_templates where company_id = my_company_id())
  );
