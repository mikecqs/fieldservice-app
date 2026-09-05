-- =============================================================================
-- MIGRATION — produção (BD já tem dados: empresas, clientes, pedidos, etc.)
--
-- Cobre TODAS as alterações de schema/RLS/RPC ainda não aplicadas à BD de
-- produção, desde o commit atualmente em produção até ao estado local atual
-- (HEAD 4c50b42 + alterações locais ainda por commitar da auditoria
-- "AUDITORIA FINAL + IMPLEMENTAÇÃO — APP"):
--   6306c79 → estado original de produção (baseline desta migração)
--   50de8bb → BLOCOS 1, 5 e 9 desta sessão (única parte do schema alterada
--             pelos BLOCOS 1–19; 6, 7, 8, 10–19 foram só validação em
--             código — Server Actions/lib/*-estado.ts — sem alterações à BD)
--   f3b2177 → Web Push (push_subscriptions, tech_delay_notifications,
--             tech_service_detalhes_visiveis, default de
--             org_settings.tipos_servico) + Relatórios (sem alterações à BD)
--   6b55b9c → só middleware.ts, sem alterações à BD
--   (local, por commitar) → auditoria "APP": profiles.ativo,
--             services.codigo, service_materials_planned.preco_venda —
--             confirmado via `git diff HEAD -- supabase/schema.sql` que é
--             exatamente isto e mais nada (sem novas tabelas/policies/
--             funções; RLS já cobre as colunas novas automaticamente, é
--             row-level, não column-level).
-- Confirmado via `git diff 6306c79 HEAD -- supabase/schema.sql` (HEAD =
-- a546776, o merge commit) — este ficheiro cobre exatamente esse diff mais
-- o diff local acima, dividido em statements seguros para uma BD com dados
-- reais.
--
-- NÃO EXECUTADO. Este ficheiro é só para revisão — corre-o tu próprio no
-- SQL Editor do Supabase depois de leres as notas de cada secção,
-- especialmente as duas assinaladas "DECISÃO PENDENTE" (requests.address_id
-- e requests.origem), que dependem de dados que só existem em produção.
--
-- Cada bloco de alterações é idempotente (drop ... if exists / if not
-- exists / create or replace) para poder ser corrido mais do que uma vez
-- sem partir nada, mas não é um substituto de teste num ambiente de
-- staging antes de aplicar a produção a sério.
-- =============================================================================

begin;

-- =============================================================================
-- BLOCO 1 — Identidade, Pedidos, ATENDIMENTO
-- =============================================================================

-- BLOCO 1 — profiles.role: acrescenta 'ATENDIMENTO' ao conjunto de roles.
-- Assume o nome de constraint por omissão do Postgres para o único check
-- inline da coluna (profiles_role_check). Se em produção tiver outro nome,
-- confirma com: select conname from pg_constraint where conrelid = 'profiles'::regclass and contype = 'c';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('SUPER_ADMIN','ADMIN','TECHNICIAN','FINANCE','ATENDIMENTO'));

-- BLOCO 1 — clients.codigo: ID humano (CLI-000001, ...). O default usa
-- nextval() (função volátil), por isso o ALTER TABLE ADD COLUMN abaixo já
-- reescreve a tabela e atribui um código sequencial a cada cliente
-- existente automaticamente — não é preciso um UPDATE de backfill à parte.
create sequence if not exists clients_codigo_seq;
alter table clients
  add column if not exists codigo text unique not null
  default ('CLI-' || lpad(nextval('clients_codigo_seq')::text, 6, '0'));

-- BLOCO 1 — requests.codigo: mesmo princípio de clients.codigo acima.
create sequence if not exists requests_codigo_seq;
alter table requests
  add column if not exists codigo text unique not null
  default ('PED-' || lpad(nextval('requests_codigo_seq')::text, 6, '0'));

-- BLOCO 1 — requests.address_id — DECISÃO PENDENTE.
-- No schema.sql atual esta coluna é "not null references client_addresses(id)".
-- Pedidos criados ANTES desta sessão não têm morada nenhuma associada — não
-- há como inventar esse dado, por isso esta migration só adiciona a coluna
-- como nullable + a FK. A app (criarPedido) já exige morada em todos os
-- pedidos NOVOS a partir de agora, independentemente do NOT NULL na BD.
-- Antes de decidires aplicar o NOT NULL, corre em produção:
--   select count(*) from requests where address_id is null;
-- Se o resultado for 0 (ou aceitares os pedidos antigos ficarem sem morada
-- para sempre), descomenta a linha abaixo:
alter table requests add column if not exists address_id uuid references client_addresses(id);
-- alter table requests alter column address_id set not null;

-- BLOCO 1 — requests.origem — DECISÃO PENDENTE (mesma razão do address_id).
-- Antes: "origem text" (opcional, texto livre). Agora: valores fixos.
-- Adicionada como NOT VALID: não falha com dados antigos fora do conjunto
-- fixo, mas passa a validar todos os pedidos novos/atualizados a partir de
-- agora. Antes de validar a constraint contra o histórico, corre:
--   select count(*) from requests where origem is null or origem not in ('Telefone','Loja','Email','Outro');
-- Não 100% idempotente (justificado): se já tiveres corrido
-- "validate constraint" manualmente depois de uma primeira execução deste
-- ficheiro, este DROP+ADD volta a marcar a constraint como NOT VALID —
-- nunca apaga dados nem falha, só obriga a repetir o VALIDATE. Não há
-- forma de evitar isto sem verificar o estado da constraint antes (fora do
-- âmbito de um script de migração simples) — por isso, se já tiveres
-- validado, corre "select convalidated from pg_constraint where conname =
-- 'requests_origem_check';" depois desta migração e repete o VALIDATE se vier false.
alter table requests drop constraint if exists requests_origem_check;
alter table requests add constraint requests_origem_check
  check (origem in ('Telefone','Loja','Email','Outro')) not valid;
-- Só depois de confirmares que o resultado da query acima é 0:
-- alter table requests validate constraint requests_origem_check;
-- alter table requests alter column origem set not null;

-- BLOCO 1 — RLS ATENDIMENTO: policies novas. "Sem conflito com as
-- existentes" refere-se à primeira execução — cada uma leva agora também
-- um DROP POLICY IF EXISTS com o mesmo nome, para a migração poder ser
-- corrida uma segunda vez (ex: numa BD que já recebeu a primeira versão
-- deste ficheiro) sem falhar com "policy already exists".
drop policy if exists "atendimento reads clients" on clients;
create policy "atendimento reads clients" on clients for select
  using (organization_id = my_org() and my_role() = 'ATENDIMENTO');
drop policy if exists "atendimento creates clients" on clients;
create policy "atendimento creates clients" on clients for insert
  with check (organization_id = my_org() and my_role() = 'ATENDIMENTO');

drop policy if exists "atendimento reads client_addresses" on client_addresses;
create policy "atendimento reads client_addresses" on client_addresses for select
  using (organization_id = my_org() and my_role() = 'ATENDIMENTO');
drop policy if exists "atendimento creates client_addresses" on client_addresses;
create policy "atendimento creates client_addresses" on client_addresses for insert
  with check (organization_id = my_org() and my_role() = 'ATENDIMENTO');

drop policy if exists "atendimento reads requests" on requests;
create policy "atendimento reads requests" on requests for select
  using (organization_id = my_org() and my_role() = 'ATENDIMENTO');
drop policy if exists "atendimento creates requests" on requests;
create policy "atendimento creates requests" on requests for insert
  with check (organization_id = my_org() and my_role() = 'ATENDIMENTO');

-- BLOCO 1 — view segura para o ATENDIMENTO acompanhar o estado operacional
-- de um pedido, sem nunca lhe dar acesso direto a budgets/services.
create or replace view requests_status_atendimento_view as
select
  r.id as request_id,
  b.estado as orcamento_estado,
  s.estado as servico_estado
from requests r
left join budgets b on b.request_id = r.id
left join services s on s.request_id = r.id
where r.organization_id = my_org() and my_role() = 'ATENDIMENTO';

grant select on requests_status_atendimento_view to authenticated;

-- =============================================================================
-- BLOCO 5 — Agenda + Serviços: robustez operacional (RLS + tech_finish_visit)
-- =============================================================================

-- BLOCO 5 — service_events.tipo: acrescenta 'cancelado' e 'reativado'.
-- Mesma nota do profiles_role_check acima sobre o nome da constraint.
alter table service_events drop constraint if exists service_events_tipo_check;
alter table service_events add constraint service_events_tipo_check
  check (tipo in (
    'criado','agendado','reagendado','iniciado','concluido','nova_visita',
    'nao_realizado','correcao_pedida','corrigido','validado','faturado',
    'cancelado','reativado','liquidado'
  ));

-- BLOCO 5 — budget_events: histórico deixa de ser "for all" (que permitia
-- UPDATE/DELETE via RLS mesmo para ADMIN/SUPER_ADMIN) — passa a select+insert.
-- Dropa tanto o nome antigo (1ª execução) como os novos nomes (reexecução).
drop policy if exists "admin manages budget_events" on budget_events;
drop policy if exists "admin reads budget_events" on budget_events;
create policy "admin reads budget_events" on budget_events for select
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
drop policy if exists "admin inserts budget_events" on budget_events;
create policy "admin inserts budget_events" on budget_events for insert
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));

-- BLOCO 5 — service_validations: mesma correção (histórico aditivo).
drop policy if exists "admin manages service_validations" on service_validations;
drop policy if exists "admin reads service_validations" on service_validations;
create policy "admin reads service_validations" on service_validations for select
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
drop policy if exists "admin inserts service_validations" on service_validations;
create policy "admin inserts service_validations" on service_validations for insert
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
grant select, insert on service_validations to authenticated;

-- BLOCO 5 — profiles: with check passa a restringir a role explicitamente a
-- ADMIN/TECHNICIAN/FINANCE (ADMIN nunca cria/promove para SUPER_ADMIN nem
-- ATENDIMENTO por esta via — corrige uma lacuna de privilege escalation).
drop policy if exists "admin can manage profiles in own org" on profiles;
create policy "admin can manage profiles in own org"
  on profiles for insert
  with check (
    my_role() = 'ADMIN'
    and organization_id = my_org()
    and role in ('ADMIN','TECHNICIAN','FINANCE')
  );

drop policy if exists "admin can update profiles in own org" on profiles;
create policy "admin can update profiles in own org"
  on profiles for update
  using (my_role() = 'ADMIN' and organization_id = my_org())
  with check (
    organization_id = my_org()
    and role in ('ADMIN','TECHNICIAN','FINANCE')
  );

-- BLOCO 5 — visits: remove a policy de UPDATE do técnico. Fechar/alterar uma
-- visita passa a ser exclusivamente via tech_finish_visit (SECURITY DEFINER).
drop policy if exists "technician updates own open visit" on visits;

-- BLOCO 5 (idempotência + reforço de estado) e BLOCO 14 (preenchimento
-- condicional de services.valor quando ainda está a 0, só quando
-- p_resultado = 'concluido' — ver comentário dentro do corpo da função):
-- corpo completo e atual de tech_finish_visit, via CREATE OR REPLACE.
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

  -- 'hora_fim_real is null' garante que a visita ainda está aberta — uma
  -- segunda chamada (retry de rede, duplo clique fora do disabled do
  -- botão, ou uma chamada direta à RPC) já não encontra a visita e aborta
  -- aqui, antes de duplicar materiais/fotos/eventos ou reabrir um serviço
  -- já validado/faturado.
  select service_id into v_service_id from visits
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

  if p_resultado = 'concluido' then
    if p_mao_obra_tipo is null or length(trim(p_mao_obra_tipo)) = 0 then
      raise exception 'Mão de obra é obrigatória para concluir o serviço.';
    end if;
    if p_mao_obra_tipo not in ('visita_orcamento','taxa_deslocacao','1h','2h','3h','4h','5h','6h','7h','8h','dia_completo','2dias','outro') then
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

  insert into visit_materials_used (visit_id, nome, qtd, preco_unit)
  select p_visit_id, item->>'nome', coalesce((item->>'qtd')::numeric, 1), coalesce((item->>'preco_unit')::numeric, 0)
  from jsonb_array_elements(p_materiais) as item;

  insert into visit_photos (visit_id, storage_path)
  select p_visit_id, unnest(p_fotos);

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
  -- calcularOrcamento), por isso nunca é afetado por este update.
  if p_resultado = 'concluido' then
    select coalesce(sum((item->>'qtd')::numeric * (item->>'preco_unit')::numeric), 0)
      into v_valor_materiais
      from jsonb_array_elements(p_materiais) as item;

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
    v_valor_mao_obra := case p_mao_obra_tipo
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
-- BLOCO 9 — completar a correção do BLOCO 5 para visit_materials_used e
-- visit_photos (tinha ficado por fazer nessas duas tabelas-filhas de visits)
-- =============================================================================

drop policy if exists "technician manages own visit materials" on visit_materials_used;
drop policy if exists "technician selects own visit materials used" on visit_materials_used;
create policy "technician selects own visit materials used" on visit_materials_used for select
  using (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));
drop policy if exists "technician inserts own visit materials used" on visit_materials_used;
create policy "technician inserts own visit materials used" on visit_materials_used for insert
  with check (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));

drop policy if exists "technician manages own visit photos" on visit_photos;
drop policy if exists "technician selects own visit photos" on visit_photos;
create policy "technician selects own visit photos" on visit_photos for select
  using (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));
drop policy if exists "technician inserts own visit photos" on visit_photos;
create policy "technician inserts own visit photos" on visit_photos for insert
  with check (exists (select 1 from visits v where v.id = visit_id and v.created_by = auth.uid()));

-- =============================================================================
-- f3b2177 — Web Push + correção de visibilidade do técnico
-- (a página de Relatórios do mesmo commit não introduz nenhuma alteração à
-- BD — lê tabelas já existentes via lib/relatorios.ts, nada aqui).
-- =============================================================================

-- f3b2177 — org_settings.tipos_servico: novo default para organizações
-- criadas a partir de agora. Não toca nenhuma linha existente (é só
-- DEFAULT, não um UPDATE) — organizações já criadas mantêm o valor que já
-- tinham gravado, mesmo que seja o array antigo.
alter table org_settings
  alter column tipos_servico set default array['Agendamento','Orçamento','Manutenção','Instalação'];

-- f3b2177 — tech_service_detalhes_visiveis: 'nova_visita' e
-- 'correcao_necessaria' passam a contar como ativos/agendáveis na fila de
-- "serviço atual + próximo" do técnico. Corrige um bug real: um serviço na
-- 3ª+ posição da fila que tivesse passado por um destes dois estados
-- expunha morada/contacto/materiais por engano (o filtro antigo não os
-- incluía na fila ativa, por isso a contagem de posição ficava errada).
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

-- f3b2177 — Web Push: tabelas novas, sem dados existentes a considerar.
-- Só guardamos o necessário para enviar a notificação (endpoint + chaves
-- públicas de subscrição, nunca nada sensível); a assinatura VAPID é feita
-- sempre no backend com a chave privada (env var), nunca no browser.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "technician manages own push subscriptions" on push_subscriptions;
create policy "technician manages own push subscriptions" on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and organization_id = my_org());

-- Garante uma única notificação de atraso por serviço (nunca repetida em
-- cada varredura do cron) — nunca apagado, é só um registo de "já avisei".
create table if not exists tech_delay_notifications (
  service_id uuid primary key references services(id) on delete cascade,
  notified_at timestamptz not null default now()
);
alter table tech_delay_notifications enable row level security;

-- f3b2177 — job pg_cron ("tech-delay-check"): NUNCA faz parte de uma
-- migração automática (contém um segredo e um URL de ambiente) — repor à
-- mão no SQL Editor, só depois de confirmar as env vars VAPID_PRIVATE_KEY/
-- NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_SUBJECT/PUSH_CHECK_SECRET no Vercel
-- (ver CLAUDE.md secção 10 — Web Push não testado em produção):
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
-- Auditoria "APP" (local, ainda por commitar) — 3 alterações de schema,
-- todas aditivas, com default constante (nunca volátil como nextval() em
-- profiles.ativo/preco_venda — não força reescrita nem risco de conflito;
-- services.codigo usa nextval() tal como clients.codigo/requests.codigo
-- acima, backfill automático no próprio ADD COLUMN). Sem alterações a
-- RLS/policies/funções: nenhuma tabela nova precisa de policy nova (RLS é
-- por linha, não por coluna — as policies existentes de services e
-- service_materials_planned já cobrem as colunas novas automaticamente) e
-- nenhuma função foi tocada nesta parte.
-- =============================================================================

-- profiles.ativo — soft delete de utilizador (nunca DELETE): desativar só
-- bloqueia acesso (getOrgId/getOrgIdAndRole/requireRole em lib/auth.ts).
-- Default true preserva o acesso de todos os utilizadores já existentes —
-- ninguém fica bloqueado por engano ao aplicar esta migração.
alter table profiles add column if not exists ativo boolean not null default true;

-- services.codigo — ID humano (OS-000001, ...), mesmo princípio de
-- clients.codigo/requests.codigo (ver BLOCO 1 acima): nextval() é volátil,
-- por isso o ADD COLUMN já atribui um código sequencial a cada serviço
-- existente automaticamente, sem UPDATE de backfill à parte.
create sequence if not exists services_codigo_seq;
alter table services
  add column if not exists codigo text unique not null
  default ('OS-' || lpad(nextval('services_codigo_seq')::text, 6, '0'));

-- service_materials_planned.preco_venda — preço de venda do material
-- planeado (antes só tinha nome+quantidade). Default 0 para linhas
-- existentes — nunca inventa um preço, fica simplesmente por preencher
-- para materiais já planeados antes desta alteração.
alter table service_materials_planned add column if not exists preco_venda numeric not null default 0;

-- =============================================================================
-- Preços comerciais da mão de obra (local, ainda por commitar) — tabela
-- comercial completa (1ª hora 40€ com deslocação, horas seguintes 30€, dia
-- completo 250€, 2 dias completos 500€, todos fixos) configurável por
-- empresa em org_settings, substituindo o cálculo linear antigo
-- (v_horas × valor_hora_mao_obra) que nunca teve UI para ser configurado —
-- por isso a mão de obra era sempre gravada a 0€ em qualquer empresa.
-- Aditivo: ADD COLUMN com default constante já faz backfill automático dos
-- 3 primeiros valores para todas as empresas existentes (nenhuma tinha
-- configurado nada, porque não havia onde). tech_finish_visit já foi
-- substituída acima (CREATE OR REPLACE) para usar as 4 colunas novas.
-- =============================================================================
alter table org_settings add column if not exists valor_mao_obra_primeira_hora numeric not null default 40;
alter table org_settings add column if not exists valor_mao_obra_hora_adicional numeric not null default 30;
alter table org_settings add column if not exists valor_mao_obra_dia_completo numeric not null default 250;

-- "2 dias completos" tem preço fixo próprio (500€), não 16 × uma taxa/hora
-- — reutiliza a coluna valor_hora_mao_obra (que só servia isto, sem UI,
-- sempre 0) em vez de criar uma coluna nova a mais: rename + novo default +
-- backfill explícito das linhas que ainda estavam no valor por omissão
-- antigo (0), a mesma lógica do ADD COLUMN DEFAULT acima, só que aqui tem
-- de ser um UPDATE porque a coluna já existia (RENAME não reescreve dados).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'org_settings' and column_name = 'valor_hora_mao_obra'
  ) then
    alter table org_settings rename column valor_hora_mao_obra to valor_mao_obra_2_dias;
  end if;
end $$;
alter table org_settings alter column valor_mao_obra_2_dias set default 500;
update org_settings set valor_mao_obra_2_dias = 500 where valor_mao_obra_2_dias = 0;

-- =============================================================================
-- Duas opções novas na tabela de Tipos de Mão de Obra (local, ainda por
-- commitar): "Visita para Orçamento" (0,00€, sempre gratuita) e "Taxa de
-- Deslocação" (20,00€) — mesmo padrão ADD COLUMN + default constante das
-- 3 colunas acima (backfill automático para as empresas já existentes,
-- nenhuma tinha nada configurado porque a coluna não existia). O CHECK de
-- visits.mao_obra_tipo já existia antes da baseline desta migração (por
-- isso nunca apareceu como ALTER neste ficheiro até agora) — atualizado
-- aqui com DROP + ADD CONSTRAINT, mesmo padrão já usado acima para
-- service_events_tipo_check. tech_finish_visit já foi substituída acima
-- (CREATE OR REPLACE) para usar as 2 colunas novas.
-- =============================================================================
alter table org_settings add column if not exists valor_mao_obra_visita_orcamento numeric not null default 0;
alter table org_settings add column if not exists valor_mao_obra_taxa_deslocacao numeric not null default 20;

alter table visits drop constraint if exists visits_mao_obra_tipo_check;
alter table visits add constraint visits_mao_obra_tipo_check
  check (mao_obra_tipo in ('visita_orcamento','taxa_deslocacao','1h','2h','3h','4h','5h','6h','7h','8h','dia_completo','2dias','outro'));

-- =============================================================================
-- Referência de fatura obrigatória (local, ainda por commitar) — antes era
-- possível marcar um serviço como faturado com faturacao_referencia vazia
-- (só a UI tinha o campo, sem required, e nem a Server Action nem a RPC
-- validavam). finance_marcar_faturado não estava neste ficheiro porque já
-- existia em produção antes da baseline desta migração — CREATE OR REPLACE
-- de toda a função, mesma assinatura (uuid, numeric, text), sem alteração
-- de permissões/grant.
-- =============================================================================
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
    'Faturado — ref. ' || p_referencia || ', valor ' || p_valor || '€.',
    auth.uid()
  );
end;
$$;
grant execute on function finance_marcar_faturado(uuid, numeric, text) to authenticated;

-- =============================================================================
-- Liquidação de serviços faturados (local, ainda por commitar) — novo estado
-- 'liquidado' em services.faturacao_estado (só alcançável a partir de
-- 'faturado', nunca diretamente de 'por_faturar') + método de pagamento
-- obrigatório (Numerário/Transferência Bancária/Multibanco/Cheque), mesmo
-- padrão de colunas faturacao_* já existentes (faturacao_data/
-- faturacao_utilizador viram faturacao_liquidado_data/
-- faturacao_liquidado_utilizador, para não confundir a data/utilizador da
-- fatura com a data/utilizador do pagamento). Novo tipo 'liquidado' em
-- service_events.tipo, aditivo (histórico continua append-only). Nova RPC
-- finance_marcar_liquidado, mesma role gate (ADMIN/SUPER_ADMIN/FINANCE) e
-- mesmo padrão de finance_marcar_faturado.
-- =============================================================================
alter table services drop constraint if exists services_faturacao_estado_check;
alter table services add constraint services_faturacao_estado_check
  check (faturacao_estado in ('por_faturar','faturado','liquidado'));

alter table services add column if not exists faturacao_metodo_pagamento text;
alter table services drop constraint if exists services_faturacao_metodo_pagamento_check;
alter table services add constraint services_faturacao_metodo_pagamento_check
  check (faturacao_metodo_pagamento in ('Numerário','Transferência Bancária','Multibanco','Cheque'));
alter table services add column if not exists faturacao_liquidado_data date;
alter table services add column if not exists faturacao_liquidado_utilizador uuid references profiles(id);

alter table service_events drop constraint if exists service_events_tipo_check;
alter table service_events add constraint service_events_tipo_check
  check (tipo in (
    'criado','agendado','reagendado','iniciado','concluido','nova_visita',
    'nao_realizado','correcao_pedida','corrigido','validado','faturado',
    'cancelado','reativado','liquidado'
  ));

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

  update services
    set faturacao_estado = 'liquidado',
        faturacao_metodo_pagamento = p_metodo_pagamento,
        faturacao_liquidado_data = current_date,
        faturacao_liquidado_utilizador = auth.uid()
    where id = p_service_id;

  insert into service_events (organization_id, service_id, tipo, descricao, utilizador)
  values (
    v_org_id, p_service_id, 'liquidado',
    'Liquidado — ' || p_metodo_pagamento || '.',
    auth.uid()
  );
end;
$$;
grant execute on function finance_marcar_liquidado(uuid, text) to authenticated;

-- =============================================================================
-- Auditoria de segurança — remove o segredo do webhook do Google Sheets de
-- dentro de enqueue_sheets_sync (estava em texto simples no SQL, commitado
-- em git). Nova tabela app_secrets (RLS ativa, ZERO policies — mesmo padrão
-- já usado em google_sheets_sync_queue/tech_delay_notifications: invisível
-- a authenticated/anon, só legível por uma função SECURITY DEFINER, que
-- corre com o privilégio do dono). enqueue_sheets_sync substituída
-- (CREATE OR REPLACE) para ler o segredo dali; se ainda não estiver
-- configurado, não envia o pedido HTTP (a fila já guardou o registo, o cron
-- de recuperação trata disto mais tarde de qualquer forma).
--
-- DEPOIS de correr este bloco, faz UMA VEZ, à parte, fora de git:
--   1. Gera um valor aleatório forte (ex: `openssl rand -hex 32`).
--   2. Atualiza a env var SHEETS_SYNC_SECRET na Vercel para esse valor
--      (isto invalida o valor antigo, que ficou exposto no histórico do
--      Git — é o que realmente resolve a exposição, não só o código).
--   3. Corre no SQL Editor (com o mesmo valor do passo 1):
--        insert into app_secrets (key, value) values ('sheets_sync_secret', 'COLA-AQUI-O-VALOR-GERADO')
--        on conflict (key) do update set value = excluded.value, updated_at = now();
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
  if v_secret is null then return; end if;

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

-- =============================================================================
-- Fotos no fecho de serviço (local, ainda por commitar) — bucket de Storage
-- novo, "visitas", para o Técnico poder enviar fotografias opcionais ao
-- fechar uma visita. visit_photos (tabela) e o parâmetro p_fotos de
-- tech_finish_visit já existiam e já funcionavam — só faltava mesmo o
-- bucket/policies para o Técnico poder enviar o ficheiro em si. Caminho
-- sempre "{organization_id}/{visit_id}/{ficheiro}"; a policy do Técnico
-- confirma posse da visita (visits.created_by = auth.uid()), mesmo critério
-- já usado em visit_materials_used/visit_photos. Só INSERT para o Técnico
-- (nunca lê de volta do Storage — as miniaturas antes de submeter são
-- sempre locais); ADMIN/SUPER_ADMIN com acesso total, igual ao bucket
-- "equipamentos" já existente.
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

-- =============================================================================
-- Visita Prévia (local, ainda por commitar) — nenhuma tabela/coluna nova
-- (services.tipo/requests.tipo já não têm CHECK, aceitam o valor livre
-- "Visita de Orçamento" sem alteração de schema). A única alteração de BD
-- real é esta: um Pedido passou a poder ter mais do que um Serviço ligado
-- (a Visita Prévia + o Serviço real que resulta do Orçamento aceite depois
-- dela), e o `left join services` original desta view fazia *fan-out*
-- (duas linhas para o mesmo pedido) nesse caso. Substituída por uma
-- subquery lateral que escolhe sempre no máximo um Serviço — o "real" tem
-- sempre prioridade sobre a Visita Prévia, mesmo critério usado do lado da
-- app em estadoOperacionalPedido() (lib/pedido-estado.ts).
-- =============================================================================
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

-- =============================================================================
-- PDF do Fecho de Serviço (local, ainda por commitar) — um único documento
-- por Serviço, sempre no mesmo caminho "{organization_id}/{service_id}/
-- fecho.pdf" (upload com upsert, nunca "v1"/"v2"). Gerado por
-- lib/pdf-fecho.ts com createAdminClient() — nunca pela sessão do Técnico
-- nem do Financeiro, precisamente para não ter de lhes dar SELECT em
-- visits/visit_materials_used/visit_photos só para montar o documento. O
-- Financeiro só precisa de ler o ficheiro já pronto.
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
-- Auditoria de segurança — soft delete de client_equipment (nunca apagar a
-- linha nem a fotografia do Storage de imediato ao clicar "remover" — sem
-- confirmação nem forma de recuperar um clique em engano antes disto).
-- =============================================================================
alter table client_equipment add column if not exists eliminado boolean not null default false;

-- =============================================================================
-- Auditoria de segurança — trigger que regista sempre um evento em
-- service_events quando services.faturacao_estado muda para 'faturado' ou
-- 'liquidado', seja qual for o caminho do UPDATE (RPC ou direto). Antes,
-- só as RPCs finance_marcar_faturado/finance_marcar_liquidado inseriam
-- esse evento; um ADMIN podia sempre fazer UPDATE direto a
-- faturacao_estado (RLS `for all` em services, decisão deliberada) sem
-- deixar nenhum rasto. CREATE OR REPLACE das duas RPCs abaixo remove o
-- insert manual duplicado (fica só a cargo do trigger, nunca duas fontes
-- do mesmo evento).
-- =============================================================================
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

  update services
    set faturacao_estado = 'liquidado',
        faturacao_metodo_pagamento = p_metodo_pagamento,
        faturacao_liquidado_data = current_date,
        faturacao_liquidado_utilizador = auth.uid()
    where id = p_service_id;
end;
$$;
grant execute on function finance_marcar_liquidado(uuid, text) to authenticated;

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

drop trigger if exists services_log_faturacao_change on services;
create trigger services_log_faturacao_change
  after update on services
  for each row
  execute function log_faturacao_change();

-- =============================================================================
-- Auditoria de superfície de ataque — bucket "equipamentos" aceitava
-- qualquer tipo de ficheiro (sem allowed_mime_types, ao contrário de
-- "visitas"/"fechos"). O INSERT ... ON CONFLICT DO NOTHING original nunca
-- atualizaria isto num bucket já existente em produção — por isso o UPDATE
-- explícito abaixo.
-- =============================================================================
update storage.buckets
  set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
  where id = 'equipamentos';

-- =============================================================================
-- Pedido do utilizador (04-05/09): pagamento reportado pelo técnico no fecho
-- (+ "fatura com NIF"), MB Way como novo meio de pagamento, e correção de
-- serviço rejeitado sem perda de dados (apos_correcao/justificacao_correcao
-- em visits — o fecho anterior serve de base para tudo o que o técnico
-- deixar em branco no refecho; só a justificação passa a obrigatória).
-- =============================================================================
alter table visits add column if not exists cliente_pagou boolean;
alter table visits add column if not exists meio_pagamento text;
alter table visits drop constraint if exists visits_meio_pagamento_check;
alter table visits add constraint visits_meio_pagamento_check
  check (meio_pagamento in ('Numerário','Transferência Bancária','Multibanco','Cheque','MB Way'));
alter table visits add column if not exists fatura_com_nif boolean;
alter table visits add column if not exists nif text;
alter table visits add column if not exists apos_correcao boolean not null default false;
alter table visits add column if not exists justificacao_correcao text;

alter table services drop constraint if exists services_faturacao_metodo_pagamento_check;
alter table services add constraint services_faturacao_metodo_pagamento_check
  check (faturacao_metodo_pagamento in ('Numerário','Transferência Bancária','Multibanco','Cheque','MB Way'));

-- Faltava SELECT para o técnico no bucket "visitas" (só tinha INSERT) —
-- necessário para mostrar as fotos do fecho anterior "congeladas" ao
-- reabrir um serviço em correção (createSignedUrl precisa de SELECT).
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

-- "create or replace function" só substitui quando a lista de parâmetros é
-- idêntica — como esta versão acrescenta 5 parâmetros novos, sem este drop
-- explícito da assinatura antiga (13 parâmetros) ficam DUAS funções
-- tech_finish_visit a coexistir, e o Postgres deixa de conseguir escolher
-- qual chamar ("Could not choose the best candidate function") — foi
-- exatamente isto que aconteceu em produção ao correr este ficheiro pela
-- primeira vez, confirmado pelo erro 500 em /tecnico/servico/[id].
drop function if exists tech_finish_visit(uuid, text, text, jsonb, text[], text, text, date, time, text, text, numeric, text);

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

  -- Duplica materiais/fotos da visita rejeitada anterior para esta — somam
  -- aos que o técnico tenha acrescentado acima, nunca substituem (histórico
  -- da visita anterior continua intacto, isto só garante que nada
  -- "desaparece" da nova visita).
  if v_apos_correcao and v_visita_anterior_id is not null then
    insert into visit_materials_used (visit_id, nome, qtd, preco_unit)
    select p_visit_id, nome, qtd, preco_unit
    from visit_materials_used
    where visit_id = v_visita_anterior_id;

    insert into visit_photos (visit_id, storage_path)
    select p_visit_id, storage_path
    from visit_photos
    where visit_id = v_visita_anterior_id;
  end if;

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

  v_novo_estado := case when p_resultado = 'concluido' then 'aguarda_validacao' else p_resultado end;

  if p_resultado = 'nova_visita' then
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
-- Edição de Pedido (descrição/morada) com log de alterações — única edição
-- de campos livres que existe em toda a app; request_events é o histórico
-- aditivo correspondente (mesmo espírito de service_events/budget_events).
-- =============================================================================
create table if not exists request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  tipo text not null check (tipo in ('editado')),
  descricao text not null,
  utilizador uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table request_events enable row level security;

drop policy if exists "admin reads request_events" on request_events;
create policy "admin reads request_events" on request_events for select
  using (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));
drop policy if exists "admin inserts request_events" on request_events;
create policy "admin inserts request_events" on request_events for insert
  with check (organization_id = my_org() and my_role() in ('ADMIN','SUPER_ADMIN'));

grant select, insert on request_events to authenticated;

commit;

-- =============================================================================
-- FIM. Depois de aplicar isto em produção:
--   - Os BLOCOS 6, 7, 8, 10–19 desta sessão, a página de Relatórios do
--     f3b2177, e toda a auditoria "APP" (Dashboard/Atenção, Agenda,
--     Serviços, Orçamentos, Faturação, Utilizadores, Configurações, Super
--     Admin), os preços comerciais da mão de obra, a referência de fatura
--     obrigatória e o bucket "visitas" para fotos do fecho de serviço, não
--     precisam de nenhuma alteração adicional à BD além das colunas/
--     funções/buckets acima — o resto foi só código (Server Actions/
--     páginas), publicado com o deploy normal da app (git push + vercel
--     --prod).
--   - Visita Prévia (Fluxos A e B) também não precisa de nenhuma coluna/
--     tabela nova — só o `create or replace view` acima (fan-out corrigido
--     em requests_status_atendimento_view). Todo o resto (Server Actions,
--     páginas, o rótulo "Visita Prévia" na UI) é só código.
--   - PDF do Fecho de Serviço: só o bucket "fechos" + as duas policies acima
--     (Admin total, Financeiro só leitura) — sem coluna/sequência nova
--     (services.codigo reaproveitado como ID_Fecho). O resto (geração do
--     PDF, chamada nos 4 pontos do ciclo, botão "Ver PDF do Fecho") é só
--     código.
--   - Tipos de Mão de Obra "Visita para Orçamento"/"Taxa de Deslocação":
--     2 colunas novas em org_settings + o CHECK de visits.mao_obra_tipo
--     atualizado + tech_finish_visit substituída acima — sem tabela nova. O
--     resto (lib/mao-obra.ts, o formulário do Técnico, Configurações) é só
--     código.
--   - Falta ainda, fora deste ficheiro: configurar as 4 env vars de Web
--     Push no Vercel e agendar manualmente o job pg_cron acima — sem isso,
--     as tabelas/policies existem mas a funcionalidade não envia nada.
--   - Liquidação de serviços faturados (estado 'liquidado' + método de
--     pagamento): só as colunas/CHECKs de services/service_events + a RPC
--     finance_marcar_liquidado acima — sem tabela/bucket novo. O resto
--     (lib/faturacao-opcoes.ts, a Server Action marcarLiquidado, a secção
--     "Liquidados" do PainelFaturacao, e as estatísticas Faturado vs
--     Recebido em lib/financeiro.ts) é só código.
--   - Auditoria de segurança — remoção do segredo hardcoded de
--     enqueue_sheets_sync: depois de correr o bloco acima, FALTA MESMO
--     fazer os 3 passos manuais descritos nesse bloco (gerar valor novo,
--     atualizar SHEETS_SYNC_SECRET na Vercel, inserir em app_secrets) —
--     sem isso a sincronização Google Sheets fica silenciosamente parada
--     (a fila continua a guardar tudo, só o envio em tempo quase real é
--     que não dispara; o cron de recuperação também não consegue nada sem
--     o segredo configurado).
--   - Auditoria de segurança — soft delete de client_equipment: só a
--     coluna acima (ver bloco antes do "commit;"), sem tabela nova. O
--     resto (Server Action removerEquipamento a marcar em vez de apagar, a
--     query da ficha do cliente a filtrar eliminado=false, a confirmação
--     nos 3 botões "remover" da app) é só código.
--   - Auditoria de segurança — trigger services_log_faturacao_change: só
--     o CREATE OR REPLACE das duas RPCs de faturação (sem o insert manual
--     duplicado) + a função/trigger novos acima — sem tabela nova.
--   - Auditoria de superfície de ataque — bucket "equipamentos" restrito a
--     imagens (UPDATE acima) + fora deste ficheiro: Host Header Injection
--     corrigido em app/admin/utilizadores/actions.ts e nas rotas do Google
--     Sheets (novo lib/app-url.ts), e cabeçalhos de segurança/CSP em
--     next.config.mjs — tudo só código, sem alteração à BD.
--   - Pagamento no fecho técnico + "fatura com NIF" + MB Way + correção sem
--     perda de dados: só as colunas novas de visits + o CHECK atualizado de
--     services.faturacao_metodo_pagamento + a policy de SELECT em falta no
--     bucket "visitas" para o técnico + tech_start_service/tech_finish_visit
--     substituídas acima — sem tabela nova. O resto (lib/faturacao-opcoes.ts,
--     o formulário do Técnico, a Server Action concluirVisita, e a exibição
--     no histórico de visitas da ficha do Serviço) é só código.
--   - Agendar na aceitação do orçamento + link "Ver serviço criado" mais
--     defensivo: nenhuma alteração à BD — reaproveita escreverAgendamentoServico
--     e verificarConflitoAgenda já existentes, e o fix do link é só uma
--     verificação extra na query da página.
--   - Edição de Pedido (descrição/morada) com log: só a tabela request_events
--     + as suas 2 policies acima. O resto (editarPedido, EditarPedidoForm.tsx,
--     e a secção "Histórico de edições" em PedidoDetalheConteudo.tsx) é só
--     código.
-- =============================================================================
