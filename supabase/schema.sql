-- =============================================================================
-- FieldService — schema completo para Supabase (Postgres)
-- Multi-tenant: SUPER_ADMIN (todas as empresas) > ADMIN (por empresa) >
-- TECHNICIAN / FINANCE / ATENDIMENTO (acesso restrito, por empresa)
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
  role text not null check (role in ('SUPER_ADMIN','ADMIN','TECHNICIAN','FINANCE','ATENDIMENTO')),
  nome text not null,
  email text not null,
  -- Soft delete: desativar um utilizador nunca apaga a conta nem o
  -- histórico associado (service_events.utilizador, etc.) — só bloqueia
  -- acesso (verificado em getOrgId/getOrgIdAndRole/requireRole).
  ativo boolean not null default true,
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
  tipos_servico text[] not null default array['Agendamento','Orçamento','Manutenção','Instalação'],
  followup_dias_default int not null default 3,
  -- Controlo operacional: quando ativo, um técnico só vê os detalhes
  -- operacionais (morada, contacto, descrição, notas) do seu próximo
  -- serviço agendado depois de encerrar o anterior. Ver
  -- tech_service_desbloqueado() e services_technician_view.
  acesso_sequencial_tecnico boolean not null default false,
  -- Tabela comercial de mão de obra (fecho de OS pelo Técnico): 1ª hora já
  -- inclui deslocação; horas seguintes a preço avulso; "dia completo" é um
  -- valor fixo explícito, nunca 8 × hora adicional. Ver tech_finish_visit
  -- (cálculo real) e lib/mao-obra.ts::calcularPrecoMaoObra (mesma fórmula,
  -- do lado do preview do Técnico).
  valor_mao_obra_primeira_hora numeric not null default 40,
  valor_mao_obra_hora_adicional numeric not null default 30,
  valor_mao_obra_dia_completo numeric not null default 250,
  valor_mao_obra_2_dias numeric not null default 500,
  -- Duas opções adicionais à tabela comercial (nunca uma duração real, por
  -- isso fora de HORAS_MAO_OBRA/sugerirMaoObraPorDuracao em lib/mao-obra.ts):
  -- "Visita para Orçamento" é sempre gratuita por definição de negócio, mas
  -- fica configurável como as restantes, em vez de um 0 hardcoded só no
  -- calculo — mesma tabela, mesmo padrão, só um valor por omissão diferente.
  valor_mao_obra_visita_orcamento numeric not null default 0,
  valor_mao_obra_taxa_deslocacao numeric not null default 20
);

-- -----------------------------------------------------------------------------
-- CLIENTES
-- -----------------------------------------------------------------------------
-- Sequência global (não por empresa) para o "código" humano do cliente —
-- mesmo padrão já usado em budgets.numero (ver mais abaixo). nextval() é
-- atómico no Postgres, por isso dois inserts em simultâneo nunca colidem;
-- o valor nunca é reutilizado mesmo que o cliente seja apagado.
create sequence if not exists clients_codigo_seq;

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- ID humano permanente (CLI-000001, CLI-000002, ...) — só para UI/pesquisa/
  -- operação; todas as relações continuam a usar sempre o uuid "id".
  -- "unique" reforça a nível de constraint o que o nextval() já garante.
  codigo text not null unique default ('CLI-' || lpad(nextval('clients_codigo_seq')::text, 6, '0')),
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
  created_at timestamptz not null default now(),
  -- Soft delete (auditoria de segurança) — "remover equipamento" antes
  -- apagava a linha e a fotografia do Storage de imediato, sem confirmação
  -- nem forma de recuperar um clique em engano. Nunca apagado de verdade;
  -- só deixa de aparecer na ficha do cliente (query filtra eliminado=false)
  -- — mesmo espírito de profiles.ativo (nunca apagar, só esconder).
  eliminado boolean not null default false
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
create sequence if not exists requests_codigo_seq;

create table requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- ID humano permanente (PED-000001, PED-000002, ...) — mesmo princípio de
  -- clients.codigo acima.
  codigo text not null unique default ('PED-' || lpad(nextval('requests_codigo_seq')::text, 6, '0')),
  client_id uuid not null references clients(id) on delete cascade,
  -- Morada obrigatória em todos os pedidos, sempre da morada do próprio
  -- cliente (client_addresses já é filtrada por client_id no formulário e
  -- validada no servidor) — nunca a de outro cliente.
  address_id uuid not null references client_addresses(id),
  tipo text not null,
  descricao text not null,
  origem text not null check (origem in ('Telefone','Loja','Email','Outro')),
  info_falta boolean not null default false,
  estado text not null default 'novo' check (estado in ('novo','orcamento','convertido','arquivado')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

-- -----------------------------------------------------------------------------
-- HISTÓRICO DE EDIÇÃO DO PEDIDO — mesmo espírito de service_events/
-- budget_events: nunca se apaga, guarda sempre quem/quando/o que mudou.
-- Ao contrário dos outros dois, não é histórico de transição de estado (o
-- Pedido continua sem "forçar estado" nenhum) — é só o registo aditivo de
-- editarPedido (descrição/morada), que é a única edição de campos livres
-- que existe em toda a app.
-- -----------------------------------------------------------------------------
create table request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  tipo text not null check (tipo in ('editado')),
  descricao text not null,
  utilizador uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table request_events enable row level security;

-- Histórico aditivo — só SELECT/INSERT, nunca UPDATE/DELETE (nem para
-- ADMIN/SUPER_ADMIN), mesmo padrão de service_events/budget_events.
create policy "admin reads request_events" on request_events for select
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
create policy "admin inserts request_events" on request_events for insert
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));

grant select, insert on request_events to authenticated;

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
  -- follow-up automático: preenchido quando o orçamento é marcado como
  -- enviado (ver marcarEnviado), sempre X dias depois do envio.
  followup_em date,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- HISTÓRICO DO ORÇAMENTO — mesmo espírito de service_events: nunca se apaga,
-- guarda sempre quem/quando/porquê de cada transição.
-- -----------------------------------------------------------------------------
create table budget_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  budget_id uuid not null references budgets(id) on delete cascade,
  tipo text not null check (tipo in ('criado','enviado','followup','aceite','recusado','cancelado')),
  descricao text not null,
  utilizador uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table budget_events enable row level security;

-- Histórico aditivo — só SELECT/INSERT, nunca UPDATE/DELETE (nem para
-- ADMIN/SUPER_ADMIN). Antes era uma única policy "for all", que permitia
-- UPDATE/DELETE via RLS (o grant já abaixo só dava select/insert, mas a
-- policy em si estava errada — corrigido aqui para as duas nunca poderem
-- divergir outra vez).
create policy "admin reads budget_events" on budget_events for select
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
create policy "admin inserts budget_events" on budget_events for insert
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));

create policy "finance reads budget_events" on budget_events for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

grant select, insert on budget_events to authenticated;

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

-- técnico só lê (para preçar materiais no fecho da OS), nunca gere o catálogo.
create policy "technician reads catalog_items" on catalog_items for select
  using (organization_id = my_org() and my_role() = 'TECHNICIAN');

grant select, insert, update, delete on catalog_items to authenticated;

-- -----------------------------------------------------------------------------
-- SERVIÇOS (ordens de serviço)
-- -----------------------------------------------------------------------------
-- ID humano permanente (OS-000001, OS-000002, ...) — mesmo princípio de
-- clients.codigo/requests.codigo. Só para UI/pesquisa; uuid continua a
-- ser a única chave usada em relações, queries e URLs.
create sequence if not exists services_codigo_seq;

create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  codigo text not null unique default ('OS-' || lpad(nextval('services_codigo_seq')::text, 6, '0')),
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
  faturacao_estado text not null default 'por_faturar'
    check (faturacao_estado in ('por_faturar','faturado','liquidado')),
  faturacao_data date,
  faturacao_valor numeric,
  faturacao_referencia text,
  faturacao_utilizador uuid references profiles(id),
  -- liquidação (pagamento recebido) — só preenchido depois de 'faturado'
  faturacao_metodo_pagamento text
    check (faturacao_metodo_pagamento in ('Numerário','Transferência Bancária','Multibanco','Cheque','MB Way')),
  faturacao_liquidado_data date,
  faturacao_liquidado_utilizador uuid references profiles(id),
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
  qtd numeric not null default 1,
  preco_venda numeric not null default 0
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
  mao_obra_tipo text check (mao_obra_tipo in ('visita_orcamento','taxa_deslocacao','1h','2h','3h','4h','5h','6h','7h','8h','dia_completo','2dias','outro')),
  mao_obra_detalhe text,
  -- checklist de fecho, diferente consoante o tipo do serviço (ver
  -- tech_finish_visit): problema_identificado/testes_realizados aplicam-se
  -- a Manutenção/Instalação respetivamente; quantidade_instalada só a
  -- Instalação. Ficam a null quando não se aplicam ao tipo.
  problema_identificado text,
  equipamento_instalado text,
  quantidade_instalada numeric,
  testes_realizados text,
  -- valor do serviço calculado automaticamente no fecho (materiais com
  -- preço + mão de obra × taxa/hora) — só informativo para o Admin,
  -- nunca substitui services.valor sozinho.
  valor_calculado numeric,
  -- pagamento reportado pelo técnico no fecho — só informação para o
  -- Finance decidir depois; nunca marca sozinho faturacao_estado/
  -- liquidação (isso continua exclusivo das RPCs finance_*).
  cliente_pagou boolean,
  meio_pagamento text
    check (meio_pagamento in ('Numerário','Transferência Bancária','Multibanco','Cheque','MB Way')),
  fatura_com_nif boolean,
  nif text,
  -- true quando esta visita foi aberta a partir de um serviço
  -- 'correcao_necessaria' (tech_start_service) — tech_finish_visit usa
  -- isto para saber que só a justificação é obrigatória, duplicando os
  -- restantes campos da visita rejeitada anterior quando o técnico os
  -- deixa em branco (nunca apaga nem edita essa visita anterior).
  apos_correcao boolean not null default false,
  justificacao_correcao text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table visit_materials_used (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  nome text not null,
  qtd numeric not null default 1,
  -- preço à data da utilização (não o preço atual do catálogo, que pode
  -- mudar depois) — é o que permite calcular o valor do serviço no fecho.
  preco_unit numeric not null default 0
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
    'nao_realizado','correcao_pedida','corrigido','validado','faturado',
    'cancelado','reativado','liquidado'
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

-- Nota de segurança: o "with check" restringe explicitamente a role a
-- ADMIN/TECHNICIAN/FINANCE — um ADMIN nunca pode criar nem promover um
-- perfil (incluindo o próprio) para SUPER_ADMIN por esta via. Isto é
-- imposto aqui na RLS, não só na Server Action de app/admin/utilizadores.
create policy "admin can manage profiles in own org"
  on profiles for insert
  with check (
    my_role() = 'ADMIN'
    and organization_id = my_org()
    and role in ('ADMIN','TECHNICIAN','FINANCE')
  );

create policy "admin can update profiles in own org"
  on profiles for update
  using (my_role() = 'ADMIN' and organization_id = my_org())
  with check (
    organization_id = my_org()
    and role in ('ADMIN','TECHNICIAN','FINANCE')
  );

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

-- técnico só lê (para ver o valor/hora da mão de obra no fecho da OS) —
-- nada aqui é sensível, é só configuração operacional da própria empresa.
create policy "technician reads org_settings" on org_settings for select
  using (organization_id = my_org() and my_role() = 'TECHNICIAN');

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

-- ---------------------------------------------------------------------------
-- ATENDIMENTO — role de loja física (substitui os pedidos em papel).
-- Só pode criar clientes/moradas/pedidos e ler o que existe na própria
-- empresa; nunca tem UPDATE/DELETE nestas tabelas (decisões como converter
-- em orçamento ou arquivar continuam exclusivas do ADMIN/SUPER_ADMIN) e não
-- tem policy nenhuma em budgets/services/purchases/faturação — sem policy
-- de select numa tabela com RLS ativo, a tabela fica invisível para essa
-- role, mesmo que a query da app tente lê-la, ou alguém navegue direto para
-- um URL /admin/*. A área /atendimento/* nem sequer faz essas queries, mas
-- a barreira real está aqui.
-- ---------------------------------------------------------------------------
create policy "atendimento reads clients" on clients for select
  using (organization_id = my_org() and my_role() = 'ATENDIMENTO');
create policy "atendimento creates clients" on clients for insert
  with check (organization_id = my_org() and my_role() = 'ATENDIMENTO');

create policy "atendimento reads client_addresses" on client_addresses for select
  using (organization_id = my_org() and my_role() = 'ATENDIMENTO');
create policy "atendimento creates client_addresses" on client_addresses for insert
  with check (organization_id = my_org() and my_role() = 'ATENDIMENTO');

create policy "atendimento reads requests" on requests for select
  using (organization_id = my_org() and my_role() = 'ATENDIMENTO');
create policy "atendimento creates requests" on requests for insert
  with check (organization_id = my_org() and my_role() = 'ATENDIMENTO');

-- View segura para o ATENDIMENTO acompanhar o estado operacional de um
-- pedido (ex: "orçamento enviado", "serviço agendado") sem nunca lhe dar
-- acesso às tabelas budgets/services em si — só os dois campos `estado`,
-- nunca valor, iva, materiais ou faturação. Mesmo princípio já usado em
-- services_technician_view: a view corre com os privilégios do dono (não
-- do chamador), por isso consegue ler budgets/services mesmo o Atendimento
-- não tendo policy nenhuma nessas tabelas — mas o próprio corpo da view
-- filtra sempre por organização e por role, nunca expondo dados de outra
-- empresa. A app do lado do cliente reutiliza sempre a mesma função de
-- rótulo (estadoOperacionalPedido, em lib/pedido-estado.ts) que já é usada
-- pelo Admin — nunca um segundo sistema de estado.
--
-- Atualização (auditoria "Visita Prévia") — um Pedido passou a poder ter
-- mais do que um Serviço ligado (a Visita Prévia + o Serviço real que
-- resulta do Orçamento aceite depois dela). Um `left join services` simples
-- faria *fan-out* (duas linhas na view para o mesmo pedido) assim que isso
-- acontecesse; a subquery lateral abaixo escolhe sempre no máximo um
-- Serviço — o "real" (qualquer tipo que não seja a Visita Prévia) tem
-- sempre prioridade sobre ela, e só na ausência de um Serviço real é que a
-- própria Visita Prévia aparece. Mesmo critério usado do lado da app em
-- estadoOperacionalPedido() (lib/pedido-estado.ts) — nunca uma segunda
-- regra divergente. 'Visita de Orçamento' aqui tem de continuar igual ao
-- valor de TIPO_VISITA_ORCAMENTO em lib/servico-estado.ts — o nome visível
-- ao utilizador passou a ser "Visita Prévia", mas o valor gravado em
-- services.tipo não mudou (evita reescrever dados já gravados só por causa
-- de uma string).
create or replace view requests_status_atendimento_view as
select
  r.id as request_id,
  b.estado as orcamento_estado,
  s.estado as servico_estado
from requests r
left join budgets b on b.request_id = r.id
left join lateral (
  select services.estado
  from services
  where services.request_id = r.id
  order by (services.tipo = 'Visita de Orçamento') asc, services.created_at desc
  limit 1
) s on true
where r.organization_id = my_org() and my_role() = 'ATENDIMENTO';

grant select on requests_status_atendimento_view to authenticated;

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
-- Histórico aditivo — só SELECT/INSERT, nunca UPDATE/DELETE (nem para
-- ADMIN/SUPER_ADMIN); as próprias validações/rejeições continuam a ser
-- escritas sempre pelas RPCs finance_validar_servico/finance_rejeitar_servico
-- (SECURITY DEFINER), nunca por um insert direto do Admin — a policy de
-- insert aqui é só para essas RPCs terem grant, não para uso direto na app.
create policy "admin reads service_validations" on service_validations for select
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
create policy "admin inserts service_validations" on service_validations for insert
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
create policy "finance reads service_validations" on service_validations for select
  using (organization_id = my_org() and my_role() = 'FINANCE');

grant select, insert on service_validations to authenticated;

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

-- Sem policy de UPDATE para o técnico (propositadamente): fechar/alterar
-- uma visita passa sempre pela RPC tech_finish_visit (SECURITY DEFINER),
-- nunca por um UPDATE direto do técnico a esta tabela — evita reabrir ou
-- editar uma visita já fechada, ou mexer em valor_calculado, por fora da
-- RPC. Só SELECT (acima) e INSERT (abaixo) continuam disponíveis.

-- visit_materials_used / visit_photos: seguem a visita
create policy "admin manages visit_materials_used" on visit_materials_used for all
  using (
    exists (
      select 1 from visits v where v.id = visit_id and v.organization_id = my_org()
    ) and my_role() in ('ADMIN','SUPER_ADMIN')
  );
-- Sem UPDATE/DELETE para o técnico (mesma correção do BLOCO 5 para
-- `visits`, aplicada aqui — tinha ficado por fazer): materiais usados só
-- entram via tech_finish_visit (SECURITY DEFINER), nunca por edição direta
-- de uma visita já fechada. Só SELECT e INSERT ficam disponíveis.
create policy "technician selects own visit materials used" on visit_materials_used for select
  using (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));
create policy "technician inserts own visit materials used" on visit_materials_used for insert
  with check (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));

create policy "admin manages visit_photos" on visit_photos for all
  using (
    exists (select 1 from visits v where v.id = visit_id and v.organization_id = my_org())
    and my_role() in ('ADMIN','SUPER_ADMIN')
  );
-- Mesma correção: sem UPDATE/DELETE para o técnico, só SELECT e INSERT.
create policy "technician selects own visit photos" on visit_photos for select
  using (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));
create policy "technician inserts own visit photos" on visit_photos for insert
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
  -- 'nova_visita' e 'correcao_necessaria' continuam ativos/agendáveis (o
  -- técnico ainda os vai fazer), por isso entram na mesma fila de "atual +
  -- seguinte" que 'agendado'/'em_curso'. Ficarem de fora fazia o primeiro
  -- disjunto (s.estado not in (...)) devolver true sem olhar à posição real
  -- na fila — um serviço 3º/4º na fila que tivesse passado por "nova
  -- visita" ficava com morada/contacto/materiais expostos por engano.
  select
    s.estado not in ('agendado','em_curso','nova_visita','correcao_necessaria')
    or s.data_agendada is null or s.hora_agendada is null
    or (
      select count(*)
      from services s2
      join service_technicians st2 on st2.service_id = s2.id
      where st2.user_id = auth.uid()
        and s2.estado in ('agendado','em_curso','nova_visita','correcao_necessaria')
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

  insert into visits (organization_id, service_id, data, hora_inicio_real, created_by, apos_correcao)
  values (v_org_id, p_service_id, current_date, current_time, auth.uid(), v_estado_anterior = 'correcao_necessaria')
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
  p_testes_realizados text default null,
  p_cliente_pagou boolean default null,
  p_meio_pagamento text default null,
  p_fatura_com_nif boolean default null,
  p_nif text default null,
  p_justificacao_correcao text default null
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
  v_estado_servico text;
  v_novo_estado text;
  v_valor_primeira_hora numeric;
  v_valor_hora_adicional numeric;
  v_valor_dia_completo numeric;
  v_valor_2_dias numeric;
  v_valor_visita_orcamento numeric;
  v_valor_taxa_deslocacao numeric;
  v_valor_materiais numeric;
  v_valor_mao_obra numeric;
  v_apos_correcao boolean;
  v_visita_anterior_id uuid;
  v_prev_trabalho text;
  v_prev_problema text;
  v_prev_equipamento text;
  v_prev_quantidade numeric;
  v_prev_testes text;
  v_prev_mao_obra_tipo text;
  v_prev_mao_obra_detalhe text;
  v_efetivo_mao_obra_tipo text;
begin
  if p_resultado not in ('concluido', 'nova_visita', 'nao_realizado') then
    raise exception 'Resultado inválido.';
  end if;

  -- 'hora_fim_real is null' garante que a visita ainda está aberta — uma
  -- segunda chamada (retry de rede, duplo clique fora do disabled do
  -- botão, ou uma chamada direta à RPC) já não encontra a visita e aborta
  -- aqui, antes de duplicar materiais/fotos/eventos ou reabrir um serviço
  -- já validado/faturado.
  select service_id, apos_correcao into v_service_id, v_apos_correcao from visits
  where id = p_visit_id and created_by = auth.uid() and hora_fim_real is null;

  if v_service_id is null then
    raise exception 'Visita não encontrada, já fechada, ou não pertence a este técnico.';
  end if;

  select organization_id, tipo, estado into v_org_id, v_tipo, v_estado_servico from services where id = v_service_id;

  -- Reforço adicional: o serviço tem mesmo de estar 'em_curso' (só chega lá
  -- via tech_start_service). Cobre o caso raro de o serviço ter mudado de
  -- estado por outra via entre o início e o fecho da visita.
  if v_estado_servico != 'em_curso' then
    raise exception 'Este serviço já não está em curso — não é possível fechar esta visita.';
  end if;

  -- Correção (apos_correcao=true, marcado por tech_start_service ao reabrir
  -- a partir de 'correcao_necessaria'): nada do fecho anterior desaparece —
  -- vai servir de base para tudo o que o técnico deixar em branco agora.
  -- Nenhum campo passa a obrigatório aqui além da justificação (pedido
  -- explícito): o técnico só precisa de explicar a correção, não repetir
  -- tudo o que já preencheu.
  if v_apos_correcao then
    select id, trabalho_realizado, problema_identificado, equipamento_instalado, quantidade_instalada, testes_realizados, mao_obra_tipo, mao_obra_detalhe
      into v_visita_anterior_id, v_prev_trabalho, v_prev_problema, v_prev_equipamento, v_prev_quantidade, v_prev_testes, v_prev_mao_obra_tipo, v_prev_mao_obra_detalhe
      from visits
      where service_id = v_service_id and id != p_visit_id and hora_fim_real is not null
      order by created_at desc
      limit 1;

    if length(trim(coalesce(p_justificacao_correcao, ''))) = 0 then
      raise exception 'Justificação da correção é obrigatória.';
    end if;
  else
    -- 'trabalho realizado' serve de notas em qualquer resultado —
    -- obrigatório em todos os casos (antes só era exigido para 'concluido').
    if length(trim(coalesce(p_trabalho_realizado, ''))) = 0 then
      if p_resultado = 'concluido' then
        raise exception 'Trabalho realizado é obrigatório para concluir o serviço.';
      else
        raise exception 'Notas são obrigatórias.';
      end if;
    end if;
  end if;

  if p_resultado = 'concluido' then
    if not v_apos_correcao and (p_mao_obra_tipo is null or length(trim(p_mao_obra_tipo)) = 0) then
      raise exception 'Mão de obra é obrigatória para concluir o serviço.';
    end if;
    if p_mao_obra_tipo is not null and p_mao_obra_tipo not in ('visita_orcamento','taxa_deslocacao','1h','2h','3h','4h','5h','6h','7h','8h','dia_completo','2dias','outro') then
      raise exception 'Tipo de mão de obra inválido.';
    end if;
    if p_mao_obra_tipo = 'outro' and length(trim(coalesce(p_mao_obra_detalhe, ''))) = 0 then
      raise exception 'Descreve a mão de obra em "Outro".';
    end if;

    -- checklist de fecho: campos obrigatórios diferentes consoante o tipo
    -- do serviço, validados sempre aqui (nunca só na UI) — dispensado numa
    -- correção, onde o valor anterior serve de base quando não preenchido.
    if not v_apos_correcao then
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

    if p_cliente_pagou is true and (p_meio_pagamento is null or p_meio_pagamento not in ('Numerário','Transferência Bancária','Multibanco','Cheque','MB Way')) then
      raise exception 'Indica o meio de pagamento.';
    end if;
    if p_fatura_com_nif is true and length(trim(coalesce(p_nif, ''))) = 0 then
      raise exception 'Indica o NIF do cliente.';
    end if;
  end if;

  update visits
    set hora_fim_real = current_time,
        trabalho_realizado = case
          when length(trim(coalesce(p_trabalho_realizado, ''))) > 0 then p_trabalho_realizado
          when v_apos_correcao then v_prev_trabalho
          else p_trabalho_realizado
        end,
        resultado = p_resultado,
        mao_obra_tipo = case
          when p_resultado != 'concluido' then null
          when p_mao_obra_tipo is not null then p_mao_obra_tipo
          when v_apos_correcao then v_prev_mao_obra_tipo
          else null
        end,
        mao_obra_detalhe = case
          when p_resultado != 'concluido' then null
          when p_mao_obra_detalhe is not null then p_mao_obra_detalhe
          when v_apos_correcao then v_prev_mao_obra_detalhe
          else null
        end,
        problema_identificado = case
          when p_resultado != 'concluido' or v_tipo = 'Instalação' then null
          when length(trim(coalesce(p_problema_identificado, ''))) > 0 then p_problema_identificado
          when v_apos_correcao then v_prev_problema
          else null
        end,
        equipamento_instalado = case
          when p_resultado != 'concluido' or v_tipo != 'Instalação' then null
          when length(trim(coalesce(p_equipamento_instalado, ''))) > 0 then p_equipamento_instalado
          when v_apos_correcao then v_prev_equipamento
          else null
        end,
        quantidade_instalada = case
          when p_resultado != 'concluido' or v_tipo != 'Instalação' then null
          when p_quantidade_instalada is not null then p_quantidade_instalada
          when v_apos_correcao then v_prev_quantidade
          else null
        end,
        testes_realizados = case
          when p_resultado != 'concluido' or v_tipo != 'Instalação' then null
          when length(trim(coalesce(p_testes_realizados, ''))) > 0 then p_testes_realizados
          when v_apos_correcao then v_prev_testes
          else null
        end,
        cliente_pagou = case when p_resultado = 'concluido' then p_cliente_pagou else null end,
        meio_pagamento = case when p_resultado = 'concluido' and p_cliente_pagou is true then p_meio_pagamento else null end,
        fatura_com_nif = case when p_resultado = 'concluido' then p_fatura_com_nif else null end,
        nif = case when p_resultado = 'concluido' and p_fatura_com_nif is true then p_nif else null end,
        justificacao_correcao = p_justificacao_correcao
    where id = p_visit_id;

  insert into visit_materials_used (visit_id, nome, qtd, preco_unit)
  select p_visit_id, item->>'nome', coalesce((item->>'qtd')::numeric, 1), coalesce((item->>'preco_unit')::numeric, 0)
  from jsonb_array_elements(p_materiais) as item;

  insert into visit_photos (visit_id, storage_path)
  select p_visit_id, unnest(p_fotos);

  -- Fotos da visita rejeitada anterior duplicam-se sempre para esta — somam
  -- às que o técnico tenha acrescentado acima, nunca substituem (histórico
  -- da visita anterior continua intacto). Materiais NÃO se duplicam aqui:
  -- o técnico já os vê pré-preenchidos e editáveis no formulário (UI), por
  -- isso p_materiais já chega com a lista completa pretendida — duplicar
  -- aqui também contaria tudo a dobrar.
  if v_apos_correcao and v_visita_anterior_id is not null then
    insert into visit_photos (visit_id, storage_path)
    select p_visit_id, storage_path
    from visit_photos
    where visit_id = v_visita_anterior_id;
  end if;

  -- valor calculado do serviço: materiais (qtd × preço) + mão de obra
  -- (horas × taxa/hora da empresa) — continua só informativo para o Admin
  -- durante a validação; nunca substitui um services.valor já definido
  -- (por orçamento aceite ou introduzido manualmente em "Novo Serviço"),
  -- isso continua a ser decisão do Admin no fecho de faturação.
  --
  -- BLOCO 14 — única exceção, deliberada: quando services.valor ainda está
  -- no valor por omissão (0). É sempre o caso de um serviço criado
  -- diretamente a partir de um Pedido tipo "Agendamento" ou do popup
  -- "criar novo" da Agenda — nenhum dos dois fluxos tem campo de preço,
  -- por isso nunca há nada para "substituir": é a primeira vez que existe
  -- um valor real (nunca inventado, é sempre materiais+mão de obra
  -- efetivamente registados pelo técnico) para gravar. Um serviço vindo de
  -- orçamento aceite nunca tem valor exatamente 0 (vem de
  -- calcularOrcamento), por isso nunca é afetado por este update — e, numa
  -- correção, o primeiro fecho já deixou valor != 0, por isso o "Preço
  -- atual" (services.valor) nunca muda no refecho, mesmo que os materiais/
  -- mão de obra tenham mudado.
  if p_resultado = 'concluido' then
    select coalesce(sum(qtd * preco_unit), 0)
      into v_valor_materiais
      from visit_materials_used
      where visit_id = p_visit_id;

    v_efetivo_mao_obra_tipo := case
      when p_mao_obra_tipo is not null then p_mao_obra_tipo
      when v_apos_correcao then v_prev_mao_obra_tipo
      else null
    end;

    select valor_mao_obra_primeira_hora, valor_mao_obra_hora_adicional, valor_mao_obra_dia_completo, valor_mao_obra_2_dias,
           valor_mao_obra_visita_orcamento, valor_mao_obra_taxa_deslocacao
      into v_valor_primeira_hora, v_valor_hora_adicional, v_valor_dia_completo, v_valor_2_dias,
           v_valor_visita_orcamento, v_valor_taxa_deslocacao
      from org_settings where organization_id = v_org_id;

    -- Tabela comercial, não horas × taxa fixa: 1ª hora inclui deslocação,
    -- horas seguintes a preço avulso, "dia completo"/8h e "2 dias
    -- completos" são valores fixos explícitos (nunca derivados de
    -- horas × taxa). "Visita para Orçamento"/"Taxa de Deslocação" são o
    -- mesmo princípio: valores fixos configuráveis, nunca uma duração.
    v_valor_mao_obra := case v_efetivo_mao_obra_tipo
      when 'visita_orcamento' then coalesce(v_valor_visita_orcamento, 0)
      when 'taxa_deslocacao' then coalesce(v_valor_taxa_deslocacao, 0)
      when '1h' then coalesce(v_valor_primeira_hora, 0)
      when '2h' then coalesce(v_valor_primeira_hora, 0) + 1 * coalesce(v_valor_hora_adicional, 0)
      when '3h' then coalesce(v_valor_primeira_hora, 0) + 2 * coalesce(v_valor_hora_adicional, 0)
      when '4h' then coalesce(v_valor_primeira_hora, 0) + 3 * coalesce(v_valor_hora_adicional, 0)
      when '5h' then coalesce(v_valor_primeira_hora, 0) + 4 * coalesce(v_valor_hora_adicional, 0)
      when '6h' then coalesce(v_valor_primeira_hora, 0) + 5 * coalesce(v_valor_hora_adicional, 0)
      when '7h' then coalesce(v_valor_primeira_hora, 0) + 6 * coalesce(v_valor_hora_adicional, 0)
      when '8h' then coalesce(v_valor_dia_completo, 0)
      when 'dia_completo' then coalesce(v_valor_dia_completo, 0)
      when '2dias' then coalesce(v_valor_2_dias, 0)
      else 0
    end;

    update visits set valor_calculado = v_valor_materiais + v_valor_mao_obra where id = p_visit_id;

    update services
      set valor = v_valor_materiais + v_valor_mao_obra
      where id = v_service_id and valor = 0;
  end if;

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
      when p_resultado = 'concluido' and v_apos_correcao
        then 'Técnico marcou como concluído após correção — aguarda validação do Admin. Justificação: ' || p_justificacao_correcao
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

grant execute on function tech_finish_visit(uuid, text, text, jsonb, text[], text, text, date, time, text, text, numeric, text, boolean, text, boolean, text, text) to authenticated;

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
  if p_referencia is null or length(trim(p_referencia)) = 0 then
    raise exception 'Referência da fatura é obrigatória.';
  end if;

  select organization_id, estado, faturacao_estado into v_org_id, v_estado, v_faturacao_estado
  from services where id = p_service_id and organization_id = my_org();

  if v_org_id is null then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_estado != 'concluido' or v_faturacao_estado != 'por_faturar' then
    raise exception 'Este serviço não está pronto para faturar.';
  end if;

  -- O evento 'faturado' em service_events já não é inserido aqui — o
  -- trigger services_log_faturacao_change (abaixo) trata disso sozinho,
  -- para qualquer UPDATE que mude faturacao_estado, venha desta RPC ou de
  -- um UPDATE direto do ADMIN (que tem RLS `for all` em services) — nunca
  -- duas fontes divergentes do mesmo evento, e nunca uma alteração de
  -- faturação sem rasto no histórico, seja qual for o caminho.
  update services
    set faturacao_estado = 'faturado',
        faturacao_valor = p_valor,
        faturacao_referencia = p_referencia,
        faturacao_data = current_date,
        faturacao_utilizador = auth.uid()
    where id = p_service_id;
end;
$$;
grant execute on function finance_marcar_faturado(uuid, numeric, text) to authenticated;

-- finance_marcar_liquidado — regista o pagamento recebido de um serviço já
-- faturado. Só avança 'faturado' → 'liquidado' (nunca 'por_faturar' →
-- 'liquidado' diretamente); método de pagamento sempre obrigatório, também
-- reforçado pelo CHECK de services.faturacao_metodo_pagamento.
create or replace function finance_marcar_liquidado(p_service_id uuid, p_metodo_pagamento text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_faturacao_estado text;
begin
  if my_role() not in ('ADMIN','SUPER_ADMIN','FINANCE') then
    raise exception 'Sem permissão.';
  end if;
  if p_metodo_pagamento is null or length(trim(p_metodo_pagamento)) = 0 then
    raise exception 'Método de pagamento é obrigatório.';
  end if;

  select organization_id, faturacao_estado into v_org_id, v_faturacao_estado
  from services where id = p_service_id and organization_id = my_org();

  if v_org_id is null then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_faturacao_estado != 'faturado' then
    raise exception 'Este serviço não está pronto para liquidar.';
  end if;

  -- Ver nota equivalente em finance_marcar_faturado — o evento 'liquidado'
  -- também já não é inserido aqui, fica todo a cargo do trigger abaixo.
  update services
    set faturacao_estado = 'liquidado',
        faturacao_metodo_pagamento = p_metodo_pagamento,
        faturacao_liquidado_data = current_date,
        faturacao_liquidado_utilizador = auth.uid()
    where id = p_service_id;
end;
$$;
grant execute on function finance_marcar_liquidado(uuid, text) to authenticated;

-- =============================================================================
-- TRIGGER: regista sempre um evento em service_events quando
-- services.faturacao_estado muda para 'faturado' ou 'liquidado' — única
-- fonte deste evento (as RPCs finance_marcar_faturado/finance_marcar_liquidado
-- acima já não o inserem elas próprias). Auditoria de segurança: ADMIN tem
-- RLS `for all` em services (decisão de confiança deliberada, ver
-- CLAUDE.md) e podia sempre fazer UPDATE direto a faturacao_estado por
-- fora destas RPCs — antes disto, esse UPDATE direto não deixava rasto
-- nenhum no histórico. Um trigger de tabela corre sempre, seja qual for o
-- caminho do UPDATE (RPC ou direto), por isso fecha essa lacuna de vez.
-- Nunca dispara para outras transições (ex: reverter para 'por_faturar'
-- não é um evento válido de service_events) — fica silenciosamente sem
-- evento, mesmo comportamento de antes para esses casos fora do fluxo
-- normal.
-- =============================================================================
create or replace function log_faturacao_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.faturacao_estado is distinct from old.faturacao_estado
     and new.faturacao_estado in ('faturado', 'liquidado') then
    insert into service_events (organization_id, service_id, tipo, descricao, utilizador)
    values (
      new.organization_id, new.id, new.faturacao_estado,
      case
        when new.faturacao_estado = 'faturado' then
          'Faturado — ref. ' || coalesce(new.faturacao_referencia, '—') || ', valor ' || coalesce(new.faturacao_valor::text, '—') || '€.'
        else
          'Liquidado — ' || coalesce(new.faturacao_metodo_pagamento, '—') || '.'
      end,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger services_log_faturacao_change
  after update on services
  for each row
  execute function log_faturacao_change();

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
-- allowed_mime_types (auditoria de superfície de ataque) — antes aceitava
-- qualquer tipo de ficheiro; agora restrito a imagens, mesmo critério já
-- usado no bucket "visitas".
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipamentos', 'equipamentos', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "admin manages equipamentos storage" on storage.objects for all
  using (bucket_id = 'equipamentos' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (bucket_id = 'equipamentos' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'));

-- =============================================================================
-- STORAGE: bucket para fotografias do fecho de visita (opcional, nunca
-- obrigatório para concluir um serviço). Caminho sempre
-- "{organization_id}/{visit_id}/{ficheiro}" — a policy do Técnico usa o 2º
-- segmento para confirmar que a visita é mesmo dele (mesmo critério de posse
-- já usado em visit_materials_used/visit_photos: visits.created_by =
-- auth.uid()). Só INSERT para o Técnico (nunca SELECT/UPDATE/DELETE — as
-- miniaturas antes de submeter são sempre locais, nunca lidas de volta do
-- Storage); ADMIN/SUPER_ADMIN mantêm acesso total, igual ao bucket
-- "equipamentos".
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visitas', 'visitas', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "admin manages visitas storage" on storage.objects;
create policy "admin manages visitas storage" on storage.objects for all
  using (bucket_id = 'visitas' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (bucket_id = 'visitas' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'));

drop policy if exists "technician uploads own visit photos storage" on storage.objects;
create policy "technician uploads own visit photos storage" on storage.objects for insert
  with check (
    bucket_id = 'visitas'
    and (storage.foldername(name))[1] = my_org()::text
    and exists (
      select 1 from visits v
      where v.id::text = (storage.foldername(name))[2]
        and v.created_by = auth.uid()
    )
  );

-- Faltava SELECT: sem isto, o técnico consegue enviar fotos mas nunca
-- voltar a vê-las (ex: createSignedUrl falha) — necessário para mostrar as
-- fotos do fecho anterior "congeladas" ao reabrir um serviço em correção.
drop policy if exists "technician selects own visit photos storage" on storage.objects;
create policy "technician selects own visit photos storage" on storage.objects for select
  using (
    bucket_id = 'visitas'
    and (storage.foldername(name))[1] = my_org()::text
    and exists (
      select 1 from visits v
      where v.id::text = (storage.foldername(name))[2]
        and v.created_by = auth.uid()
    )
  );

-- =============================================================================
-- PDF DO FECHO DE SERVIÇO — um único documento por Serviço, gerado/
-- regenerado sempre no mesmo caminho "{organization_id}/{service_id}/
-- fecho.pdf" (nunca "v1"/"v2" — o upload usa sempre upsert). Gerado pela
-- lib/pdf-fecho.ts com createAdminClient() (privilégio de serviço, filtra
-- organization_id manualmente) — nunca pela sessão do Técnico/Financeiro,
-- precisamente para não ter de lhes dar SELECT em visits/
-- visit_materials_used/visit_photos (tabelas privadas do Técnico) só para
-- montar o PDF. O Financeiro só precisa de ler o FICHEIRO já pronto — nunca
-- as tabelas de origem.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fechos', 'fechos', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "admin manages fechos storage" on storage.objects;
create policy "admin manages fechos storage" on storage.objects for all
  using (bucket_id = 'fechos' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (bucket_id = 'fechos' and (storage.foldername(name))[1] = my_org()::text and my_role() in ('ADMIN','SUPER_ADMIN'));

drop policy if exists "finance reads fechos storage" on storage.objects;
create policy "finance reads fechos storage" on storage.objects for select
  using (bucket_id = 'fechos' and (storage.foldername(name))[1] = my_org()::text and my_role() = 'FINANCE');

-- =============================================================================
-- INTEGRAÇÃO GOOGLE SHEETS — espelho de gestão em tempo real por empresa.
-- Arquitetura: Supabase → Google Sheets, nunca ao contrário. Cada alteração
-- relevante enfileira um item em google_sheets_sync_queue (nunca se perde,
-- mesmo que o pg_net falhe) e tenta acordar o processamento quase de
-- imediato via webhook; uma varredura periódica (cron) apanha o que ficou
-- pendente. google_sheets_row_map guarda a linha exata de cada entidade em
-- cada folha, para o processamento fazer upsert em vez de duplicar linhas.
-- =============================================================================
create extension if not exists pg_net;

create table google_sheets_integrations (
  organization_id uuid primary key references organizations(id) on delete cascade,
  status text not null default 'desligado' check (status in ('desligado','ativo','erro')),
  spreadsheet_id text,
  spreadsheet_url text,
  google_email text,
  refresh_token text,
  last_synced_at timestamptz,
  last_error text,
  connected_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table google_sheets_integrations enable row level security;

create policy "admin manages google_sheets_integrations" on google_sheets_integrations for all
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'))
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));

-- refresh_token nunca pode ser lido pelo browser (nem por engano com
-- ".select('*')") — só o service_role (backend) o lê, e esse ignora grants.
-- Reforço a nível de coluna, não só de linha (RLS).
revoke select (refresh_token) on google_sheets_integrations from authenticated, anon;

create table google_sheets_sync_queue (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null default 'upsert' check (action in ('upsert','delete')),
  status text not null default 'pending' check (status in ('pending','done','failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index google_sheets_sync_queue_pending_idx on google_sheets_sync_queue(organization_id, status, created_at);
alter table google_sheets_sync_queue enable row level security;

create table google_sheets_row_map (
  organization_id uuid not null references organizations(id) on delete cascade,
  sheet_name text not null,
  entity_id uuid not null,
  row_number int not null,
  primary key (organization_id, sheet_name, entity_id)
);
alter table google_sheets_row_map enable row level security;

-- =============================================================================
-- SEGREDOS DE APLICAÇÃO (só para uso interno de funções SECURITY DEFINER)
--
-- Auditoria de segurança — antes, o segredo do webhook do Google Sheets
-- estava escrito em texto simples diretamente dentro de enqueue_sheets_sync
-- (abaixo), porque o Postgres gerido do Supabase não permite
-- `ALTER DATABASE ... SET` (permissão negada ao role "postgres" da pooler
-- connection) para o guardar como configuração. Isso deixava o segredo real
-- commitado no repositório Git — visível a quem tivesse acesso ao repo, e
-- permanente no histórico mesmo depois de removido do ficheiro atual.
--
-- Esta tabela substitui isso: RLS ativa e ZERO policies (mesmo padrão já
-- usado em google_sheets_sync_queue/google_sheets_row_map/
-- tech_delay_notifications acima) — invisível a "authenticated"/"anon" por
-- completo, mas continua legível por dentro de uma função SECURITY DEFINER
-- (que corre com o privilégio do dono, não do chamador). O VALOR do
-- segredo nunca fica neste ficheiro nem em nenhum ficheiro versionado — é
-- inserido/atualizado só por um INSERT/UPDATE manual no SQL Editor, fora de
-- git (ver instruções no fim do ficheiro).
-- =============================================================================
create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_secrets enable row level security;

create or replace function enqueue_sheets_sync(p_org_id uuid, p_entity_type text, p_entity_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if p_org_id is null then return; end if;
  if not exists (select 1 from google_sheets_integrations where organization_id = p_org_id and status = 'ativo') then
    return;
  end if;

  insert into google_sheets_sync_queue (organization_id, entity_type, entity_id, action)
  values (p_org_id, p_entity_type, p_entity_id, p_action);

  select value into v_secret from app_secrets where key = 'sheets_sync_secret';
  -- Sem segredo configurado (ex: ambiente novo, antes do INSERT manual em
  -- app_secrets) — nunca envia um pedido sem segredo nenhum; a fila acima já
  -- guardou o registo, o cron de recuperação apanha isto mais tarde de
  -- qualquer forma, mesmo sem o pg_net funcionar agora.
  if v_secret is null then return; end if;

  -- URL do webhook embutida diretamente (não é segredo, só o domínio
  -- público de produção) — se mudar, atualizar aqui.
  begin
    perform net.http_post(
      url := 'https://fieldservice-app-nine.vercel.app/api/integrations/google-sheets/process',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
      body := jsonb_build_object('organization_id', p_org_id)
    );
  exception when others then
    null; -- a fila garante que nada se perde mesmo que o pg_net falhe
  end;
end;
$$;

create or replace function notify_sheets_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_action text;
begin
  v_action := case when TG_OP = 'DELETE' then 'delete' else 'upsert' end;
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  perform enqueue_sheets_sync(v_row.organization_id, TG_ARGV[0], v_row.id, v_action);
  return null;
end;
$$;

create or replace function notify_sheets_sync_via_service()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_action text;
  v_org uuid;
begin
  v_action := case when TG_OP = 'DELETE' then 'delete' else 'upsert' end;
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  select organization_id into v_org from services where id = v_row.service_id;
  if v_org is not null then
    perform enqueue_sheets_sync(v_org, TG_ARGV[0], v_row.id, v_action);
  end if;
  return null;
end;
$$;

create or replace function notify_sheets_sync_via_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_action text;
  v_org uuid;
begin
  v_action := case when TG_OP = 'DELETE' then 'delete' else 'upsert' end;
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  select s.organization_id into v_org from visits v join services s on s.id = v.service_id where v.id = v_row.visit_id;
  if v_org is not null then
    perform enqueue_sheets_sync(v_org, TG_ARGV[0], v_row.id, v_action);
  end if;
  return null;
end;
$$;

create or replace function notify_sheets_sync_service_technicians()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_org uuid;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  select organization_id into v_org from services where id = v_row.service_id;
  if v_org is not null then
    perform enqueue_sheets_sync(v_org, 'service', v_row.service_id, 'upsert');
  end if;
  return null;
end;
$$;

create or replace function notify_sheets_sync_budget_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  perform enqueue_sheets_sync(v_row.organization_id, 'budget', v_row.budget_id, 'upsert');
  return null;
end;
$$;

create trigger sheets_sync_clients after insert or update or delete on clients for each row execute function notify_sheets_sync('client');
create trigger sheets_sync_requests after insert or update or delete on requests for each row execute function notify_sheets_sync('request');
create trigger sheets_sync_budgets after insert or update or delete on budgets for each row execute function notify_sheets_sync('budget');
create trigger sheets_sync_services after insert or update or delete on services for each row execute function notify_sheets_sync('service');
create trigger sheets_sync_visits after insert or update or delete on visits for each row execute function notify_sheets_sync('visit');
create trigger sheets_sync_service_events after insert on service_events for each row execute function notify_sheets_sync('service_event');
create trigger sheets_sync_budget_events after insert on budget_events for each row execute function notify_sheets_sync('budget_event');
create trigger sheets_sync_service_validations after insert on service_validations for each row execute function notify_sheets_sync('service_validation');
create trigger sheets_sync_technicians after insert or update on profiles for each row when (new.role = 'TECHNICIAN') execute function notify_sheets_sync('technician');
create trigger sheets_sync_material_planned after insert or update or delete on service_materials_planned for each row execute function notify_sheets_sync_via_service('material_planned');
create trigger sheets_sync_material_used after insert or update or delete on visit_materials_used for each row execute function notify_sheets_sync_via_visit('material_used');
create trigger sheets_sync_service_technicians after insert or delete on service_technicians for each row execute function notify_sheets_sync_service_technicians();
create trigger sheets_sync_budget_items after insert or update or delete on budget_items for each row execute function notify_sheets_sync_budget_items();

-- =============================================================================
-- WEB PUSH — notificações do Técnico (ex: risco de atraso no próximo serviço).
-- Só guardamos o necessário para enviar a notificação (endpoint + chaves
-- públicas de subscrição, nunca nada sensível); a assinatura VAPID é feita
-- sempre no backend com a chave privada (env var), nunca no browser.
-- =============================================================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "technician manages own push subscriptions" on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and organization_id = my_org());

-- Garante uma única notificação de atraso por serviço (nunca repetida em
-- cada varredura do cron) — nunca apagado, é só um registo de "já avisei".
create table tech_delay_notifications (
  service_id uuid primary key references services(id) on delete cascade,
  notified_at timestamptz not null default now()
);
alter table tech_delay_notifications enable row level security;

-- pg_cron (a cada minuto — mais frequente do que o Vercel Cron do Hobby
-- plan permitiria) chama /api/push/check-delays, que decide quem notificar
-- e envia o Web Push. A extensão + o agendamento em si não fazem parte de
-- uma migração normal de tabelas — repor manualmente se a BD for recriada:
--
--   create extension if not exists pg_cron;
--   select cron.schedule('tech-delay-check', '* * * * *', $$
--     select net.http_post(
--       url := 'https://fieldservice-app-nine.vercel.app/api/push/check-delays',
--       headers := jsonb_build_object('Content-Type','application/json','x-sync-secret','<PUSH_CHECK_SECRET>'),
--       body := '{}'::jsonb
--     );
--   $$);

-- =============================================================================
-- SEGREDO DO WEBHOOK GOOGLE SHEETS — nunca escrito neste ficheiro (ver
-- app_secrets acima). Corre isto UMA VEZ no SQL Editor, fora de git, depois
-- de gerares um valor aleatório forte (ex: `openssl rand -hex 32` no teu
-- terminal) e de o teres posto também na env var SHEETS_SYNC_SECRET da
-- Vercel — os dois valores têm de ser exatamente iguais:
--
--   insert into app_secrets (key, value) values ('sheets_sync_secret', 'COLA-AQUI-O-VALOR-GERADO')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- Nunca commitar este INSERT com o valor real preenchido — corre-o e
-- descarta, tal como o INSERT do utilizador SUPER_ADMIN abaixo.

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
