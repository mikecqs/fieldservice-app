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
  role text not null check (role in ('SUPER_ADMIN','ADMIN','TECHNICIAN')),
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
-- SERVIÇOS (ordens de serviço)
-- -----------------------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  address_id uuid references client_addresses(id),
  request_id uuid references requests(id),
  budget_id uuid references budgets(id),
  tipo text not null,
  descricao text not null,
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta')),
  data_agendada date,
  hora_agendada time,
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

-- client_addresses
create policy "admin manages client_addresses" on client_addresses for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

-- requests
create policy "admin manages requests" on requests for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

-- budgets / budget_items
create policy "admin manages budgets" on budgets for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());
create policy "admin manages budget_items" on budget_items for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

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

-- ---------------------------------------------------------------------------
-- SERVICES — acesso completo (incluindo valor/faturação) só para ADMIN/SUPER_ADMIN.
-- Técnicos NÃO têm policy de SELECT aqui: só conseguem ler via
-- `services_technician_view` (abaixo), que expõe apenas colunas seguras.
-- ---------------------------------------------------------------------------
create policy "admin manages services" on services for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org());

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
-- ACESSO SEQUENCIAL DO TÉCNICO (controlo operacional, não é GPS/tracking)
--
-- Quando org_settings.acesso_sequencial_tecnico está ativo, um serviço só
-- fica "desbloqueado" (detalhes visíveis, pode ser iniciado) se todos os
-- serviços anteriores do mesmo técnico (por data_agendada + hora_agendada,
-- encadeando entre dias) já estiverem encerrados — concluído, nova visita,
-- não realizado ou cancelado. Serviços sem data/hora agendada não entram
-- na sequência (não têm posição definida). Isto é avaliado aqui, numa
-- função só de leitura, e usado tanto pela view de agenda como pelo RPC
-- que inicia o serviço — por isso não há forma de contornar via API
-- (nem escondendo campos no ecrã nem chamando o RPC diretamente).
-- =============================================================================
create or replace function tech_service_desbloqueado(p_service_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((select not os.acesso_sequencial_tecnico from org_settings os where os.organization_id = s.organization_id), true)
    or s.data_agendada is null or s.hora_agendada is null
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

-- =============================================================================
-- VIEW SEGURA PARA TÉCNICOS
-- Expõe só o necessário para trabalhar no terreno: sem valor, sem margens,
-- sem dados de faturação. É executada com os privilégios do dono da view
-- (não do chamador), por isso consegue ler `services` mesmo o técnico não
-- tendo policy de SELECT direta na tabela — mas o próprio corpo da view
-- filtra sempre por auth.uid(), por isso um técnico nunca vê serviços de
-- outra empresa nem de outro técnico.
--
-- Os campos operacionais (descrição, notas, contacto, morada) vêm null
-- quando o serviço está bloqueado pela regra de acesso sequencial — o
-- nome do cliente e a hora continuam sempre visíveis, para o técnico
-- saber que o serviço existe e a que horas é.
-- =============================================================================
create view services_technician_view as
select
  s.id,
  s.organization_id,
  s.client_id,
  s.address_id,
  s.tipo,
  case when v.desbloqueado then s.descricao else null end as descricao,
  s.prioridade,
  s.data_agendada,
  s.hora_agendada,
  case when v.desbloqueado then s.notas else null end as notas,
  s.estado,
  c.nome as cliente_nome,
  case when v.desbloqueado then c.telefone else null end as cliente_telefone,
  case when v.desbloqueado then c.email else null end as cliente_email,
  case when v.desbloqueado then a.endereco else null end as morada,
  v.desbloqueado,
  (
    select sv.motivo from service_validations sv
    where sv.service_id = s.id and sv.acao = 'rejeitado'
    order by sv.created_at desc limit 1
  ) as motivo_correcao
from services s
join service_technicians st on st.service_id = s.id
left join clients c on c.id = s.client_id
left join client_addresses a on a.id = s.address_id
cross join lateral (select tech_service_desbloqueado(s.id) as desbloqueado) v
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
begin
  if not exists (
    select 1 from service_technicians
    where service_id = p_service_id and user_id = auth.uid()
  ) then
    raise exception 'Serviço não atribuído a este técnico.';
  end if;

  -- 'nova_visita' tem de poder reabrir (é o estado que pede uma visita extra);
  -- sem esta condição a visita era sempre criada mesmo fora destes estados,
  -- podendo duplicar visitas em cliques repetidos.
  if not exists (
    select 1 from services
    where id = p_service_id and estado in ('agendado', 'por_agendar', 'nova_visita', 'correcao_necessaria')
  ) then
    raise exception 'Este serviço não está num estado que permita iniciar uma visita.';
  end if;

  if not tech_service_desbloqueado(p_service_id) then
    raise exception 'Tens um serviço anterior por concluir. Fecha-o antes de iniciares este.';
  end if;

  update services
    set estado = 'em_curso'
    where id = p_service_id;

  insert into visits (organization_id, service_id, data, hora_inicio_real, created_by)
  select s.organization_id, s.id, current_date, current_time, auth.uid()
  from services s where s.id = p_service_id
  returning id into v_visit_id;

  return v_visit_id;
end;
$$;

grant execute on function tech_start_service(uuid) to authenticated;

create or replace function tech_finish_visit(
  p_visit_id uuid,
  p_resultado text,
  p_trabalho_realizado text,
  p_materiais jsonb default '[]'::jsonb,
  p_fotos text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_id uuid;
  v_novo_estado text;
begin
  if p_resultado not in ('concluido', 'nova_visita', 'nao_realizado') then
    raise exception 'Resultado inválido.';
  end if;
  if p_resultado = 'concluido' and (p_trabalho_realizado is null or length(trim(p_trabalho_realizado)) = 0) then
    raise exception 'Trabalho realizado é obrigatório para concluir o serviço.';
  end if;

  select service_id into v_service_id from visits
  where id = p_visit_id and created_by = auth.uid();

  if v_service_id is null then
    raise exception 'Visita não encontrada ou não pertence a este técnico.';
  end if;

  update visits
    set hora_fim_real = current_time,
        trabalho_realizado = p_trabalho_realizado,
        resultado = p_resultado
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

  update services
    set estado = v_novo_estado
    where id = v_service_id;
end;
$$;

grant execute on function tech_finish_visit(uuid, text, text, jsonb, text[]) to authenticated;

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
