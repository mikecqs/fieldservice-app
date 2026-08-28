-- =============================================================================
-- FieldService — schema completo para Supabase (Postgres)
-- Multi-tenant: SUPER_ADMIN (tu) > ADMIN (por empresa) > TECHNICIAN (por empresa)
--
-- Como usar:
-- 1. Supabase Dashboard → SQL Editor → cola este ficheiro inteiro → Run.
-- 2. Confirma em Database → Tables que tudo foi criado sem erros.
-- 3. Cria o teu utilizador SUPER_ADMIN (ver instruções no fim do ficheiro).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSÕES
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ORGANIZAÇÕES (empresas clientes do SaaS)
-- -----------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nif text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- PERFIS (1 por utilizador Supabase Auth). organization_id é NULL para SUPER_ADMIN.
-- -----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  role text not null check (role in ('SUPER_ADMIN','ADMIN','TECHNICIAN','FINANCE')),
  nome text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint org_required_unless_super_admin
    check (role = 'SUPER_ADMIN' or organization_id is not null)
);

-- Função auxiliar: devolve o perfil do utilizador autenticado.
-- SECURITY DEFINER para evitar recursão de RLS quando as próprias policies de
-- "profiles" a chamam.
create or replace function current_profile()
returns table (id uuid, organization_id uuid, role text)
language sql
security definer
stable
set search_path = public
as $$
  select id, organization_id, role from profiles where id = auth.uid();
$$;

create or replace function is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'SUPER_ADMIN');
$$;

create or replace function my_org()
returns uuid language sql security definer stable set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function my_role()
returns text language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- CONFIGURAÇÕES POR EMPRESA
-- -----------------------------------------------------------------------------
create table org_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  tipos_servico text[] not null default array['Manutenção','Instalação','Orçamento'],
  followup_dias_default int not null default 3,
  -- Controlo operacional: quando ativo, um técnico só vê os detalhes
  -- operacionais (morada, contacto, descrição, notas) do seu próximo
  -- serviço agendado depois de encerrar o anterior. Ver
  -- tech_service_desbloqueado() e services_technician_view.
  acesso_sequencial_tecnico boolean not null default false
);

-- -----------------------------------------------------------------------------
-- CLIENTES
-- -----------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nome text not null,
  empresa text,
  nif text,
  telefone text,
  email text,
  notas text,
  created_at timestamptz not null default now()
);

create table client_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  endereco text not null
);

-- -----------------------------------------------------------------------------
-- EQUIPAMENTOS DO CLIENTE — associados a uma localização, com histórico de
-- intervenções (services.equipment_id, abaixo, na secção de serviços).
-- -----------------------------------------------------------------------------
create table client_equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  address_id uuid references client_addresses(id),
  equipamento text not null,
  marca text,
  modelo text,
  numero_serie text,
  data_instalacao date,
  notas text,
  foto_path text,
  created_at timestamptz not null default now()
);

alter table client_equipment enable row level security;

create policy "admin manages client_equipment" on client_equipment for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

create policy "finance reads client_equipment" on client_equipment for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

grant select, insert, update, delete on client_equipment to authenticated;

-- -----------------------------------------------------------------------------
-- PEDIDOS
-- -----------------------------------------------------------------------------
create table requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  origem text,
  info_falta boolean not null default false,
  estado text not null default 'novo' check (estado in ('novo','orcamento','convertido','arquivado')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

-- -----------------------------------------------------------------------------
-- ORÇAMENTOS
-- -----------------------------------------------------------------------------
create sequence if not exists budgets_numero_seq;

create table budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  request_id uuid references requests(id),
  estado text not null default 'rascunho'
    check (estado in ('rascunho','enviado','aguarda_resposta','followup','aceite','recusado','cancelado')),
  followup_dias int not null default 3,
  criado_em date not null default current_date,
  enviado_em date,
  service_id uuid, -- preenchido quando aceite e convertido em serviço
  iva_percent numeric not null default 23,
  -- número amigável para o PDF/cliente (sequencial, nunca reutilizado) —
  -- o id continua a ser o uuid, isto é só para leitura humana.
  numero int not null default nextval('budgets_numero_seq'),
  created_at timestamptz not null default now()
);

create table budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  tipo text not null check (tipo in ('materiais','mao_obra','deslocacao','outros')),
  descricao text not null,
  qtd numeric not null default 1,
  valor_unit numeric not null default 0
);

-- -----------------------------------------------------------------------------
-- CATÁLOGO — importado de Excel (ex: Wintouch), usado para preencher linhas
-- de orçamento sem escrever descrição/preço à mão de cada vez.
-- -----------------------------------------------------------------------------
create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  referencia text not null,
  descricao text not null,
  preco_venda numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, referencia)
);

alter table catalog_items enable row level security;

create policy "admin manages catalog_items" on catalog_items for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

grant select, insert, update, delete on catalog_items to authenticated;

-- -----------------------------------------------------------------------------
-- SERVIÇOS (ordens de serviço)
-- -----------------------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  address_id uuid references client_addresses(id),
  request_id uuid references requests(id),
  budget_id uuid references budgets(id),
  equipment_id uuid references client_equipment(id),
  tipo text not null,
  descricao text not null,
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta')),
  data_agendada date,
  hora_agendada time,
  hora_fim_agendada time,
  notas text,
  estado text not null default 'por_agendar'
    check (estado in ('por_agendar','agendado','em_curso','concluido','nova_visita','nao_realizado','cancelado','aguarda_validacao','correcao_necessaria')),
  valor numeric not null default 0,
  -- faturação
  faturacao_estado text not null default 'por_faturar' check (faturacao_estado in ('por_faturar','faturado')),
  faturacao_data date,
  faturacao_valor numeric,
  faturacao_referencia text,
  faturacao_utilizador uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table service_technicians (
  service_id uuid not null references services(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (service_id, user_id)
);

create table service_materials_planned (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  nome text not null,
  qtd numeric not null default 1
);

-- -----------------------------------------------------------------------------
-- VISITAS (uma ordem de serviço pode ter várias)
-- -----------------------------------------------------------------------------
create table visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  data date not null default current_date,
  hora_inicio_real time,
  hora_fim_real time,
  trabalho_realizado text,
  resultado text check (resultado in ('concluido','nova_visita','nao_realizado')),
  mao_obra_tipo text check (mao_obra_tipo in ('1h','2h','3h','4h','5h','6h','7h','8h','dia_completo','2dias','outro')),
  mao_obra_detalhe text,
  -- checklist de fecho, diferente consoante o tipo do serviço (ver
  -- tech_finish_visit): problema_identificado/testes_realizados aplicam-se
  -- a Manutenção/Instalação respetivamente; quantidade_instalada só a
  -- Instalação. Ficam a null quando não se aplicam ao tipo.
  problema_identificado text,
  equipamento_instalado text,
  quantidade_instalada numeric,
  testes_realizados text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table visit_materials_used (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  nome text not null,
  qtd numeric not null default 1
);

create table visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- VALIDAÇÃO ADMINISTRATIVA DO FECHO DE OS
-- Histórico completo (nunca apagado) de cada validação/rejeição de um
-- serviço marcado como concluído pelo técnico — quem, quando, porquê.
-- -----------------------------------------------------------------------------
create table service_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  acao text not null check (acao in ('validado','rejeitado')),
  motivo text,
  utilizador uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- HISTÓRICO OPERACIONAL DA OS
-- Um único sítio com toda a vida de um serviço — criação, agendamento,
-- reagendamento, início, conclusão, nova visita, correção, validação,
-- faturação — quem e quando. Nunca se apaga nenhum evento.
-- -----------------------------------------------------------------------------
create table service_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  tipo text not null check (tipo in (
    'criado','agendado','reagendado','iniciado','concluido','nova_visita',
    'nao_realizado','correcao_pedida','corrigido','validado','faturado'
  )),
  descricao text not null,
  utilizador uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index service_events_service_idx on service_events(service_id, created_at);

alter table service_events enable row level security;

create policy service_events_select on service_events for select
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));

create policy "finance reads service_events" on service_events for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

create policy service_events_insert on service_events for insert
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));

grant select, insert on service_events to authenticated;

-- -----------------------------------------------------------------------------
-- COMPRAS
-- -----------------------------------------------------------------------------
create table purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  descricao text not null,
  fornecedor text,
  estado text not null default 'por_encomendar'
    check (estado in ('por_encomendar','encomendada','parcial','recebida','cancelada')),
  data_prevista date,
  service_id uuid references services(id),
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  nome text not null,
  qtd numeric not null default 1
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table org_settings enable row level security;
alter table clients enable row level security;
alter table client_addresses enable row level security;
alter table requests enable row level security;
alter table budgets enable row level security;
alter table budget_items enable row level security;
alter table services enable row level security;
alter table service_technicians enable row level security;
alter table service_materials_planned enable row level security;
alter table visits enable row level security;
alter table visit_materials_used enable row level security;
alter table visit_photos enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table service_validations enable row level security;

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS: só SUPER_ADMIN gere; ADMIN/TECHNICIAN só vêem a própria.
-- ---------------------------------------------------------------------------
create policy "super admin full access to organizations"
  on organizations for all
  using (is_super_admin()) with check (is_super_admin());

create policy "members can read own organization"
  on organizations for select
  using (id = my_org());

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create policy "super admin full access to profiles"
  on profiles for all
  using (is_super_admin()) with check (is_super_admin());

create policy "users can read own profile"
  on profiles for select using (id = auth.uid());

create policy "org members can read colleagues"
  on profiles for select
  using (organization_id = my_org());

create policy "admin can manage profiles in own org"
  on profiles for insert with check (my_role() = 'ADMIN' and organization_id = my_org());

create policy "admin can update profiles in own org"
  on profiles for update
  using (my_role() = 'ADMIN' and organization_id = my_org())
  with check (organization_id = my_org());

-- ---------------------------------------------------------------------------
-- HELPER genérico: policy "admin gere tudo na própria empresa" para as
-- restantes tabelas operacionais. Repetido por tabela (Postgres não tem
-- macros de policy), mas o padrão é sempre o mesmo:
--   SELECT/INSERT/UPDATE/DELETE liberados a ADMIN/SUPER_ADMIN da mesma org.
-- ---------------------------------------------------------------------------

-- org_settings
create policy "admin manages org_settings" on org_settings for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
create policy "super admin all org_settings" on org_settings for all
  using (is_super_admin()) with check (is_super_admin());

-- clients
create policy "admin manages clients" on clients for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
create policy "finance reads clients" on clients for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

-- client_addresses
create policy "admin manages client_addresses" on client_addresses for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

-- requests
create policy "admin manages requests" on requests for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
create policy "finance reads requests" on requests for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

-- budgets / budget_items
create policy "admin manages budgets" on budgets for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
create policy "finance reads budgets" on budgets for select
  using (organization_id = my_org() and my_role() = 'FINANCE');
create policy "admin manages budget_items" on budget_items for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
create policy "finance reads budget_items" on budget_items for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

-- purchases / purchase_items
create policy "admin manages purchases" on purchases for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
create policy "admin manages purchase_items" on purchase_items for all
  using (
    exists (select 1 from purchases p where p.id = purchase_id and p.organization_id = my_org())
    and my_role() in ('ADMIN','SUPER_ADMIN')
  );

-- service_validations: só Admin/Super Admin validam ou rejeitam — o técnico
-- não tem nenhuma policy aqui (nem sequer de leitura); o motivo da rejeição
-- mais recente chega-lhe só pela coluna motivo_correcao da view segura.
create policy "admin manages service_validations" on service_validations for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
create policy "finance reads service_validations" on service_validations for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

-- ---------------------------------------------------------------------------
-- SERVICES — acesso completo (incluindo valor/faturação) só para ADMIN/SUPER_ADMIN.
-- Técnicos NÃO têm policy de SELECT aqui: só conseguem ler via
-- `services_technician_view` (abaixo), que expõe apenas colunas seguras.
-- ---------------------------------------------------------------------------
create policy "admin manages services" on services for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
-- FINANCE só lê — as únicas mutações que lhe interessam (validar, rejeitar,
-- marcar faturado) passam sempre pelas RPCs finance_* mais abaixo, nunca por
-- UPDATE direto (evita que consiga alterar valor, técnicos, cliente, etc.).
create policy "finance reads services" on services for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

-- service_technicians: admin atribui; técnico só lê as suas próprias atribuições
create policy "admin manages service_technicians" on service_technicians for all
  using (
    exists (select 1 from services s where s.id = service_id and s.organization_id = my_org())
    and my_role() in ('ADMIN','SUPER_ADMIN')
  );
create policy "technician reads own assignments" on service_technicians for select
  using (user_id = auth.uid());

-- service_materials_planned: admin gere; técnico lê apenas dos serviços atribuídos
create policy "admin manages service_materials_planned" on service_materials_planned for all
  using (
    exists (select 1 from services s where s.id = service_id and s.organization_id = my_org())
    and my_role() in ('ADMIN','SUPER_ADMIN')
  );
create policy "technician reads materials of own services" on service_materials_planned for select
  using (
    exists (
      select 1 from service_technicians st
      where st.service_id = service_materials_planned.service_id and st.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- VISITS — admin vê tudo da empresa; técnico só cria/edita visitas dos
-- serviços que lhe foram atribuídos (nunca de outros técnicos ou serviços).
-- ---------------------------------------------------------------------------
create policy "admin manages visits" on visits for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

create policy "technician selects own service visits" on visits for select
  using (
    exists (
      select 1 from service_technicians st
      where st.service_id = visits.service_id and st.user_id = auth.uid()
    )
  );

create policy "technician inserts visit on own service" on visits for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from service_technicians st
      where st.service_id = visits.service_id and st.user_id = auth.uid()
    )
  );

create policy "technician updates own open visit" on visits for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- visit_materials_used / visit_photos: seguem a visita
create policy "admin manages visit_materials_used" on visit_materials_used for all
  using (
    exists (
      select 1 from visits v where v.id = visit_id and v.organization_id = my_org()
    ) and my_role() in ('ADMIN','SUPER_ADMIN')
  );
create policy "technician manages own visit materials" on visit_materials_used for all
  using (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()))
  with check (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));

create policy "admin manages visit_photos" on visit_photos for all
  using (
    exists (select 1 from visits v where v.id = visit_id and v.organization_id = my_org())
    and my_role() in ('ADMIN','SUPER_ADMIN')
  );
create policy "technician manages own visit photos" on visit_photos for all
  using (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()))
  with check (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));

-- =============================================================================
-- VISIBILIDADE DO TÉCNICO (controlo operacional, não é GPS/tracking)
--
-- O técnico consegue sempre ver a hora e o cliente de todos os seus
-- serviços. Os detalhes operacionais (morada, contacto, descrição, notas)
-- só ficam visíveis para o serviço atual e o seguinte (para poder ligar ao
-- cliente seguinte se estiver atrasado) — a partir do 2º seguinte, ficam
-- limitados. Um serviço só pode ser iniciado (RPC tech_start_service) se
-- não houver nenhum serviço anterior do técnico ainda em aberto — isso é
-- sempre verdade exatamente para "o atual". Serviços já encerrados
-- (concluído, nova visita, não realizado, cancelado, aguarda validação,
-- correção necessária) ou sem data/hora não entram nesta contagem.
-- Avaliado aqui, numa função só de leitura, usada tanto pela view de
-- agenda como pelo RPC que inicia o serviço — por isso não há forma de
-- contornar via API (nem escondendo campos no ecrã nem chamando o RPC
-- diretamente).
-- =============================================================================
create or replace function tech_service_desbloqueado(p_service_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    s.data_agendada is null or s.hora_agendada is null
    or not exists (
      select 1
      from services s2
      join service_technicians st2 on st2.service_id = s2.id
      where st2.user_id = auth.uid()
        and s2.data_agendada is not null
        and s2.hora_agendada is not null
        and (s2.data_agendada, s2.hora_agendada) < (s.data_agendada, s.hora_agendada)
        and s2.estado not in ('concluido','nova_visita','nao_realizado','cancelado','aguarda_validacao','correcao_necessaria')
    )
  from services s
  where s.id = p_service_id;
$$;

grant execute on function tech_service_desbloqueado(uuid) to authenticated;

create or replace function tech_service_detalhes_visiveis(p_service_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    s.estado not in ('agendado','em_curso')
    or s.data_agendada is null or s.hora_agendada is null
    or (
      select count(*)
      from services s2
      join service_technicians st2 on st2.service_id = s2.id
      where st2.user_id = auth.uid()
        and s2.estado in ('agendado','em_curso')
        and s2.data_agendada is not null
        and s2.hora_agendada is not null
        and (s2.data_agendada, s2.hora_agendada) < (s.data_agendada, s.hora_agendada)
    ) < 2
  from services s
  where s.id = p_service_id;
$$;

grant execute on function tech_service_detalhes_visiveis(uuid) to authenticated;

-- =============================================================================
-- VIEW SEGURA PARA TÉCNICOS
-- Expõe só o necessário para trabalhar no terreno: sem valor, sem margens,
-- sem dados de faturação. É executada com os privilégios do dono da view
-- (não do chamador), por isso consegue ler `services` mesmo o técnico não
-- tendo policy de SELECT direta na tabela — mas o próprio corpo da view
-- filtra sempre por auth.uid(), por isso um técnico nunca vê serviços de
-- outra empresa nem de outro técnico.
--
-- `desbloqueado` controla se pode iniciar (só o serviço atual);
-- `detalhes_visiveis` controla se morada/contacto/descrição/notas vêm
-- preenchidos (atual + seguinte) — o nome do cliente e a hora vêm sempre.
-- =============================================================================
create view services_technician_view as
select
  s.id,
  s.organization_id,
  s.client_id,
  s.address_id,
  s.tipo,
  case when v.detalhes_visiveis then s.descricao else null end as descricao,
  s.prioridade,
  s.data_agendada,
  s.hora_agendada,
  case when v.detalhes_visiveis then s.notas else null end as notas,
  s.estado,
  c.nome as cliente_nome,
  case when v.detalhes_visiveis then c.telefone else null end as cliente_telefone,
  case when v.detalhes_visiveis then c.email else null end as cliente_email,
  case when v.detalhes_visiveis then a.endereco else null end as morada,
  v.desbloqueado,
  (
    select sv.motivo from service_validations sv
    where sv.service_id = s.id and sv.acao = 'rejeitado'
    order by sv.created_at desc limit 1
  ) as motivo_correcao,
  v.detalhes_visiveis
from services s
join service_technicians st on st.service_id = s.id
left join clients c on c.id = s.client_id
left join client_addresses a on a.id = s.address_id
cross join lateral (
  select tech_service_desbloqueado(s.id) as desbloqueado, tech_service_detalhes_visiveis(s.id) as detalhes_visiveis
) v
where st.user_id = auth.uid();

grant select on services_technician_view to authenticated;

-- Vista de clientes/moradas "seguras" para o técnico (nome, morada, contacto —
-- sem histórico financeiro, notas internas continuam disponíveis pois são
-- operacionais, não financeiras).
create view clients_technician_view as
select distinct c.id, c.organization_id, c.nome, c.empresa, c.telefone, c.email
from clients c
join services s on s.client_id = c.id
join service_technicians st on st.service_id = s.id
where st.user_id = auth.uid();

grant select on clients_technician_view to authenticated;

create view client_addresses_technician_view as
select distinct a.*
from client_addresses a
join services s on s.address_id = a.id
join service_technicians st on st.service_id = s.id
where st.user_id = auth.uid();

grant select on client_addresses_technician_view to authenticated;

-- =============================================================================
-- FUNÇÕES RPC PARA O TÉCNICO INICIAR/CONCLUIR SERVIÇOS
--
-- O técnico não tem (propositadamente) permissão de UPDATE na tabela
-- `services` — só Admin/Super Admin têm. Mas precisa de conseguir mudar o
-- estado do seu próprio serviço (Agendado → Em curso → Concluído). A solução
-- não é abrir UPDATE geral para o técnico (isso permitiria alterar valor,
-- cliente, datas, etc.) — é dar-lhe duas funções SECURITY DEFINER muito
-- específicas, que só sabem fazer exatamente isto e mais nada, e que
-- verificam sempre por dentro que o serviço lhe está mesmo atribuído.
-- =============================================================================

create or replace function tech_start_service(p_service_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit_id uuid;
  v_org_id uuid;
  v_estado_anterior text;
begin
  if not exists (
    select 1 from service_technicians
    where service_id = p_service_id and user_id = auth.uid()
  ) then
    raise exception 'Serviço não atribuído a este técnico.';
  end if;

  select organization_id, estado into v_org_id, v_estado_anterior
  from services where id = p_service_id;

  -- 'nova_visita' tem de poder reabrir (é o estado que pede uma visita extra);
  -- sem esta condição a visita era sempre criada mesmo fora destes estados,
  -- podendo duplicar visitas em cliques repetidos.
  if v_estado_anterior not in ('agendado', 'por_agendar', 'nova_visita', 'correcao_necessaria') then
    raise exception 'Este serviço não está num estado que permita iniciar uma visita.';
  end if;

  if not tech_service_desbloqueado(p_service_id) then
    raise exception 'Tens um serviço anterior por concluir. Fecha-o antes de iniciares este.';
  end if;

  update services
    set estado = 'em_curso'
    where id = p_service_id;

  insert into visits (organization_id, service_id, data, hora_inicio_real, created_by)
  values (v_org_id, p_service_id, current_date, current_time, auth.uid())
  returning id into v_visit_id;

  -- histórico: distingue reabertura após correção de um início normal.
  insert into service_events (organization_id, service_id, tipo, descricao, utilizador)
  values (
    v_org_id, p_service_id,
    case when v_estado_anterior = 'correcao_necessaria' then 'corrigido' else 'iniciado' end,
    case when v_estado_anterior = 'correcao_necessaria'
      then 'Técnico reabriu o serviço após pedido de correção.'
      else 'Técnico iniciou o serviço.'
    end,
    auth.uid()
  );

  return v_visit_id;
end;
$$;

grant execute on function tech_start_service(uuid) to authenticated;

create or replace function tech_finish_visit(
  p_visit_id uuid,
  p_resultado text,
  p_trabalho_realizado text,
  p_materiais jsonb default '[]'::jsonb,
  p_fotos text[] default '{}'::text[],
  p_mao_obra_tipo text default null,
  p_mao_obra_detalhe text default null,
  p_nova_data_agendada date default null,
  p_nova_hora_agendada time default null,
  p_problema_identificado text default null,
  p_equipamento_instalado text default null,
  p_quantidade_instalada numeric default null,
  p_testes_realizados text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_id uuid;
  v_org_id uuid;
  v_tipo text;
  v_novo_estado text;
begin
  if p_resultado not in ('concluido', 'nova_visita', 'nao_realizado') then
    raise exception 'Resultado inválido.';
  end if;

  -- 'trabalho realizado' serve de notas em qualquer resultado — obrigatório
  -- em todos os casos (antes só era exigido para 'concluido').
  if length(trim(coalesce(p_trabalho_realizado, ''))) = 0 then
    if p_resultado = 'concluido' then
      raise exception 'Trabalho realizado é obrigatório para concluir o serviço.';
    else
      raise exception 'Notas são obrigatórias.';
    end if;
  end if;

  select service_id into v_service_id from visits
  where id = p_visit_id and created_by = auth.uid();

  if v_service_id is null then
    raise exception 'Visita não encontrada ou não pertence a este técnico.';
  end if;

  select organization_id, tipo into v_org_id, v_tipo from services where id = v_service_id;

  if p_resultado = 'concluido' then
    if p_mao_obra_tipo is null or length(trim(p_mao_obra_tipo)) = 0 then
      raise exception 'Mão de obra é obrigatória para concluir o serviço.';
    end if;
    if p_mao_obra_tipo not in ('1h','2h','3h','4h','5h','6h','7h','8h','dia_completo','2dias','outro') then
      raise exception 'Tipo de mão de obra inválido.';
    end if;
    if p_mao_obra_tipo = 'outro' and length(trim(coalesce(p_mao_obra_detalhe, ''))) = 0 then
      raise exception 'Descreve a mão de obra em "Outro".';
    end if;

    -- checklist de fecho: campos obrigatórios diferentes consoante o tipo
    -- do serviço, validados sempre aqui (nunca só na UI).
    if v_tipo = 'Instalação' then
      if length(trim(coalesce(p_equipamento_instalado, ''))) = 0 then
        raise exception 'Equipamento instalado é obrigatório.';
      end if;
      if p_quantidade_instalada is null or p_quantidade_instalada <= 0 then
        raise exception 'Quantidade instalada é obrigatória.';
      end if;
      if length(trim(coalesce(p_testes_realizados, ''))) = 0 then
        raise exception 'Testes realizados são obrigatórios.';
      end if;
    else
      if length(trim(coalesce(p_problema_identificado, ''))) = 0 then
        raise exception 'Problema identificado é obrigatório.';
      end if;
    end if;
  end if;

  update visits
    set hora_fim_real = current_time,
        trabalho_realizado = p_trabalho_realizado,
        resultado = p_resultado,
        mao_obra_tipo = case when p_resultado = 'concluido' then p_mao_obra_tipo else null end,
        mao_obra_detalhe = case when p_resultado = 'concluido' then p_mao_obra_detalhe else null end,
        problema_identificado = case when p_resultado = 'concluido' and v_tipo != 'Instalação' then p_problema_identificado else null end,
        equipamento_instalado = case when p_resultado = 'concluido' and v_tipo = 'Instalação' then p_equipamento_instalado else null end,
        quantidade_instalada = case when p_resultado = 'concluido' and v_tipo = 'Instalação' then p_quantidade_instalada else null end,
        testes_realizados = case when p_resultado = 'concluido' and v_tipo = 'Instalação' then p_testes_realizados else null end
    where id = p_visit_id;

  insert into visit_materials_used (visit_id, nome, qtd)
  select p_visit_id, item->>'nome', coalesce((item->>'qtd')::numeric, 1)
  from jsonb_array_elements(p_materiais) as item;

  insert into visit_photos (visit_id, storage_path)
  select p_visit_id, unnest(p_fotos);

  -- 'concluido' fica a aguardar validação do Admin antes de ir para
  -- faturação — ver "VALIDAÇÃO ADMINISTRATIVA DO FECHO DE OS" acima.
  -- O resultado da visita em si (histórico) continua a gravar 'concluido'.
  v_novo_estado := case when p_resultado = 'concluido' then 'aguarda_validacao' else p_resultado end;

  if p_resultado = 'nova_visita' then
    -- cliente já combinou nova data: agenda-se logo no mesmo serviço, sem
    -- perder o histórico (a visita anterior continua gravada em 'visits').
    -- sem data: fica pendente de agendamento para o Admin.
    update services
      set estado = v_novo_estado,
          data_agendada = p_nova_data_agendada,
          hora_agendada = p_nova_hora_agendada
      where id = v_service_id;
  else
    update services
      set estado = v_novo_estado
      where id = v_service_id;
  end if;

  insert into service_events (organization_id, service_id, tipo, descricao, utilizador)
  values (
    v_org_id, v_service_id,
    p_resultado,
    case
      when p_resultado = 'concluido' then 'Técnico marcou como concluído — aguarda validação do Admin.'
      when p_resultado = 'nova_visita' and p_nova_data_agendada is not null
        then 'Técnico pediu nova visita — já agendada com o cliente para ' || p_nova_data_agendada || ' ' || coalesce(p_nova_hora_agendada::text, '') || '.'
      when p_resultado = 'nova_visita' then 'Técnico pediu nova visita — cliente ainda não combinou data.'
      else 'Técnico marcou como não foi possível realizar.'
    end,
    auth.uid()
  );
end;
$$;

grant execute on function tech_finish_visit(uuid, text, text, jsonb, text[], text, text, date, time, text, text, numeric, text) to authenticated;

-- =============================================================================
-- RPCs DE FATURAÇÃO — usadas tanto por ADMIN como por FINANCE (role #10).
-- FINANCE não tem UPDATE direto em `services`: só estas 3 mutações muito
-- específicas, sempre validadas aqui dentro (nunca confiando no que o
-- cliente envia), para nunca abrir uma porta para editar valor, técnicos,
-- cliente, etc. só porque tem acesso à página de faturação.
-- =============================================================================
create or replace function finance_validar_servico(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_estado text;
begin
  if my_role() not in ('ADMIN','SUPER_ADMIN','FINANCE') then
    raise exception 'Sem permissão.';
  end if;

  select organization_id, estado into v_org_id, v_estado
  from services where id = p_service_id and organization_id = my_org();

  if v_org_id is null then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_estado != 'aguarda_validacao' then
    raise exception 'Este serviço não está à espera de validação.';
  end if;

  update services set estado = 'concluido' where id = p_service_id;

  insert into service_validations (organization_id, service_id, acao, utilizador)
  values (v_org_id, p_service_id, 'validado', auth.uid());

  insert into service_events (organization_id, service_id, tipo, descricao, utilizador)
  values (v_org_id, p_service_id, 'validado', 'Admin/Financeiro validou o fecho do serviço.', auth.uid());
end;
$$;
grant execute on function finance_validar_servico(uuid) to authenticated;

create or replace function finance_rejeitar_servico(p_service_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_estado text;
begin
  if my_role() not in ('ADMIN','SUPER_ADMIN','FINANCE') then
    raise exception 'Sem permissão.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Motivo é obrigatório.';
  end if;

  select organization_id, estado into v_org_id, v_estado
  from services where id = p_service_id and organization_id = my_org();

  if v_org_id is null then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_estado != 'aguarda_validacao' then
    raise exception 'Este serviço não está à espera de validação.';
  end if;

  update services set estado = 'correcao_necessaria' where id = p_service_id;

  insert into service_validations (organization_id, service_id, acao, motivo, utilizador)
  values (v_org_id, p_service_id, 'rejeitado', p_motivo, auth.uid());

  insert into service_events (organization_id, service_id, tipo, descricao, utilizador)
  values (v_org_id, p_service_id, 'correcao_pedida', 'Admin/Financeiro pediu correção: ' || p_motivo, auth.uid());
end;
$$;
grant execute on function finance_rejeitar_servico(uuid, text) to authenticated;

create or replace function finance_marcar_faturado(p_service_id uuid, p_valor numeric, p_referencia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_estado text;
  v_faturacao_estado text;
begin
  if my_role() not in ('ADMIN','SUPER_ADMIN','FINANCE') then
    raise exception 'Sem permissão.';
  end if;

  select organization_id, estado, faturacao_estado into v_org_id, v_estado, v_faturacao_estado
  from services where id = p_service_id and organization_id = my_org();

  if v_org_id is null then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_estado != 'concluido' or v_faturacao_estado != 'por_faturar' then
    raise exception 'Este serviço não está pronto para faturar.';
  end if;

  update services
    set faturacao_estado = 'faturado',
        faturacao_valor = p_valor,
        faturacao_referencia = p_referencia,
        faturacao_data = current_date,
        faturacao_utilizador = auth.uid()
    where id = p_service_id;

  insert into service_events (organization_id, service_id, tipo, descricao, utilizador)
  values (
    v_org_id, p_service_id, 'faturado',
    'Faturado — ref. ' || coalesce(nullif(p_referencia, ''), 's/ referência') || ', valor ' || p_valor || '€.',
    auth.uid()
  );
end;
$$;
grant execute on function finance_marcar_faturado(uuid, numeric, text) to authenticated;

-- =============================================================================
-- TRIGGER: cria automaticamente um registo em org_settings quando nasce uma
-- organização nova, para nunca haver empresa sem configurações.
-- =============================================================================
create or replace function handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into org_settings (organization_id) values (new.id);
  return new;
end;
$$;

create trigger on_organization_created
  after insert on organizations
  for each row execute function handle_new_organization();

-- =============================================================================
-- STORAGE: bucket para fotografias de equipamentos do cliente (opcional).
-- Caminho sempre "{organization_id}/{...}" — é isso que a policy verifica.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('equipamentos', 'equipamentos', false, 5242880)
on conflict (id) do nothing;

create policy "admin manages equipamentos storage" on storage.objects for all
  using (bucket_id = 'equipamentos' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (bucket_id = 'equipamentos' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'));

-- =============================================================================
-- PRÓXIMO PASSO: criar o teu utilizador SUPER_ADMIN
-- =============================================================================
-- 1. Supabase Dashboard → Authentication → Users → Add user
--    (cria o teu login com email + password).
-- 2. Copia o "User UID" gerado.
-- 3. Corre este INSERT (substitui o UUID e o email/nome):
--
--    insert into profiles (id, organization_id, role, nome, email)
--    values ('COLA-AQUI-O-UUID', null, 'SUPER_ADMIN', 'O Teu Nome', 'o-teu-email@exemplo.pt');
--
-- A partir daqui, entras na app, vais a /super-admin, e crias a primeira
-- empresa + o respetivo Admin.
-- =============================================================================
