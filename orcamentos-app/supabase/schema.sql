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
    check (estado in ('rascunho', 'enviado', 'followup', 'aceite', 'servico_realizado', 'faturado', 'recusado', 'cancelado')),
  condicoes text,
  iva_percent numeric not null default 23,
  validade_dias integer not null default 30,
  notas text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  followup_em date,
  updated_at timestamptz not null default now(),
  -- Liga um orçamento duplicado ao original — só para o trigger de log de
  -- budget_events (secção 8) conseguir escrever "Duplicado a partir de X"
  -- sem a app precisar de inserir o evento manualmente.
  duplicado_de_id uuid references budgets (id) on delete set null
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
    check (tipo in ('criado', 'enviado', 'followup', 'aceite', 'servico_realizado', 'faturado', 'recusado', 'cancelado', 'duplicado')),
  descricao text not null,
  created_at timestamptz not null default now()
);

create index budget_events_budget_id_idx on budget_events (budget_id);

alter table budget_events enable row level security;

-- Só select — nunca update/delete, e (desde a secção 8) nunca insert
-- direto do utilizador. É um registo histórico, tem de ficar imutável e
-- não forjável: só as funções SECURITY DEFINER da secção 8 escrevem aqui,
-- sempre a partir de uma mudança de estado real em `budgets`.
create policy "user reads own budget events"
  on budget_events for select
  using (
    budget_id in (select id from budgets where company_id = my_company_id())
  );

-- ---------------------------------------------------------------------------
-- 6. budget_templates (modelos base — até 3 por empresa; o limite é
--    validado na Server Action E reforçado por trigger na secção 8, para
--    nunca ser contornável por um insert direto à API)
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
-- 8. Enforcement de máquina de estados e imutabilidade (triggers)
-- ---------------------------------------------------------------------------
-- RLS (secções 1-6) só garante isolamento entre empresas — nunca validou
-- transições de estado, imutabilidade depois de faturado, nem impedia
-- forjar budget_events. Estes triggers fecham essa lacuna diretamente no
-- Postgres, para serem verdadeiros mesmo que alguém ignore a app Next.js
-- por completo (ver auditoria de segurança, VULN-01). Detalhe completo do
-- raciocínio em supabase/migrations/005_state_machine_enforcement.sql.

-- 8.1 budgets — grafo de transições + imutabilidade, replicado de
--     lib/orcamento-estado.ts (fonte de verdade = código, não este
--     comentário):
--       rascunho  → enviado | followup | aceite | recusado | cancelado
--       enviado   → followup | aceite | recusado | cancelado
--       followup  → followup | aceite | recusado | cancelado
--       aceite    → servico_realizado | cancelado
--       servico_realizado → faturado | cancelado
--       faturado / recusado / cancelado → terminal, sem saída
create or replace function enforce_budget_transition()
returns trigger
language plpgsql
as $$
declare
  estados_terminais constant text[] := array['faturado', 'recusado', 'cancelado'];
  transicoes_validas constant jsonb := '{
    "rascunho": ["enviado", "followup", "aceite", "recusado", "cancelado"],
    "enviado": ["followup", "aceite", "recusado", "cancelado"],
    "followup": ["followup", "aceite", "recusado", "cancelado"],
    "aceite": ["servico_realizado", "cancelado"],
    "servico_realizado": ["faturado", "cancelado"]
  }'::jsonb;
begin
  if old.estado = any(estados_terminais) then
    raise exception 'Orçamento em estado terminal (%) não pode ser alterado.', old.estado
      using errcode = '23514';
  end if;

  if new.estado is distinct from old.estado then
    if not coalesce((transicoes_validas -> old.estado) ? new.estado, false) then
      raise exception 'Transição de estado inválida: % → %.', old.estado, new.estado
        using errcode = '23514';
    end if;
  end if;

  if new.iva_percent is distinct from old.iva_percent and old.estado <> 'rascunho' then
    raise exception 'IVA só pode ser alterado enquanto o orçamento está em rascunho.'
      using errcode = '23514';
  end if;

  if new.numero is distinct from old.numero then
    raise exception 'O número do orçamento não pode ser alterado.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger budgets_enforce_transition
  before update on budgets
  for each row execute function enforce_budget_transition();

-- 8.2 budget_events — gerado só por trigger (nunca por insert direto do
--     utilizador; a policy de insert foi removida na secção 5).
create or replace function log_budget_created()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  origem_numero text;
begin
  if new.duplicado_de_id is not null then
    select numero into origem_numero from budgets where id = new.duplicado_de_id;
    insert into budget_events (budget_id, tipo, descricao)
    values (new.id, 'duplicado', 'Duplicado a partir do orçamento ' || coalesce(origem_numero, '—') || '.');
  else
    insert into budget_events (budget_id, tipo, descricao)
    values (new.id, 'criado', 'Orçamento criado.');
  end if;
  return new;
end;
$$;

create trigger budgets_log_created
  after insert on budgets
  for each row execute function log_budget_created();

create or replace function log_budget_state_change()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  tipo_evento text;
  descricao_evento text;
begin
  if new.estado is distinct from old.estado then
    if new.estado = 'followup' and old.estado = 'rascunho' then
      tipo_evento := 'enviado';
      descricao_evento := 'Orçamento marcado como enviado. Follow-up agendado para '
        || coalesce(new.followup_em::text, '—') || '.';
    elsif new.estado = 'followup' then
      tipo_evento := 'followup';
      descricao_evento := 'Follow-up marcado para ' || coalesce(new.followup_em::text, '—') || '.';
    else
      tipo_evento := new.estado;
      descricao_evento := case new.estado
        when 'aceite' then 'Orçamento aceite.'
        when 'servico_realizado' then 'Serviço marcado como realizado.'
        when 'faturado' then 'Orçamento faturado — concluído.'
        when 'recusado' then 'Orçamento marcado como recusado.'
        when 'cancelado' then 'Orçamento cancelado.'
        else 'Orçamento passou a ' || new.estado || '.'
      end;
    end if;

    insert into budget_events (budget_id, tipo, descricao) values (new.id, tipo_evento, descricao_evento);

  elsif new.followup_em is distinct from old.followup_em and new.estado = 'followup' then
    insert into budget_events (budget_id, tipo, descricao)
    values (new.id, 'followup', 'Follow-up marcado para ' || coalesce(new.followup_em::text, '—') || '.');
  end if;

  return new;
end;
$$;

create trigger budgets_log_state_change
  after update on budgets
  for each row execute function log_budget_state_change();

-- 8.3 budget_items — só editáveis enquanto o orçamento-pai está em
--     rascunho (replica podeEditarItensOrcamento na base de dados).
create or replace function enforce_budget_items_editable()
returns trigger
language plpgsql
as $$
declare
  budget_id_alvo uuid;
  estado_atual text;
begin
  budget_id_alvo := coalesce(new.budget_id, old.budget_id);

  select estado into estado_atual from budgets where id = budget_id_alvo;

  if estado_atual is null then
    raise exception 'Orçamento não encontrado.' using errcode = '23514';
  end if;

  if estado_atual <> 'rascunho' then
    raise exception 'Itens só podem ser alterados enquanto o orçamento está em rascunho (estado atual: %).', estado_atual
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger budget_items_enforce_editable
  before insert or update or delete on budget_items
  for each row execute function enforce_budget_items_editable();

-- 8.4 budget_templates — limite de 3/empresa, seguro contra concorrência
--     (lock da linha de `companies` da empresa serializa inserts
--     concorrentes, sem precisar de Redis/lock externo).
create or replace function enforce_template_limit()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  perform 1 from companies where id = new.company_id for update;

  select count(*) into total from budget_templates where company_id = new.company_id;

  if total >= 3 then
    raise exception 'Limite de 3 modelos de orçamento por empresa atingido.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger budget_templates_enforce_limit
  before insert on budget_templates
  for each row execute function enforce_template_limit();

-- ---------------------------------------------------------------------------
-- 9. Storage: bucket privado para logos das empresas
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
