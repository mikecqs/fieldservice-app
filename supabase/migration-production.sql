-- =============================================================================
-- MIGRATION — produção (BD já tem dados: empresas, clientes, pedidos, etc.)
--
-- Cobre TODAS as alterações de schema/RLS/RPC ainda não aplicadas à BD de
-- produção, desde o commit atualmente em produção até ao HEAD local (após
-- o merge de origin/master):
--   6306c79 → estado original de produção (baseline desta migração)
--   50de8bb → BLOCOS 1, 5 e 9 desta sessão (única parte do schema alterada
--             pelos BLOCOS 1–19; 6, 7, 8, 10–19 foram só validação em
--             código — Server Actions/lib/*-estado.ts — sem alterações à BD)
--   f3b2177 → Web Push (push_subscriptions, tech_delay_notifications,
--             tech_service_detalhes_visiveis, default de
--             org_settings.tipos_servico) + Relatórios (sem alterações à BD)
--   6b55b9c → só middleware.ts, sem alterações à BD
-- Confirmado via `git diff 6306c79 HEAD -- supabase/schema.sql` (HEAD =
-- a546776, o merge commit) — este ficheiro é exatamente esse diff, dividido
-- em statements seguros para uma BD com dados reais.
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
    'cancelado','reativado'
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
  v_valor_hora numeric;
  v_horas numeric;
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

    select valor_hora_mao_obra into v_valor_hora from org_settings where organization_id = v_org_id;
    v_horas := case p_mao_obra_tipo
      when '1h' then 1 when '2h' then 2 when '3h' then 3 when '4h' then 4
      when '5h' then 5 when '6h' then 6 when '7h' then 7 when '8h' then 8
      when 'dia_completo' then 8 when '2dias' then 16 else 0
    end;
    v_valor_mao_obra := v_horas * coalesce(v_valor_hora, 0);

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

commit;

-- =============================================================================
-- FIM. Depois de aplicar isto em produção:
--   - Os BLOCOS 6, 7, 8, 10–19 desta sessão e a página de Relatórios do
--     f3b2177 não precisam de nenhuma alteração adicional à BD — já eram
--     só código (Server Actions / lib/*-estado.ts / lib/relatorios.ts),
--     publicado com o deploy normal da app (git push + vercel --prod).
--   - Falta ainda, fora deste ficheiro: configurar as 4 env vars de Web
--     Push no Vercel e agendar manualmente o job pg_cron acima — sem isso,
--     as tabelas/policies existem mas a funcionalidade não envia nada.
-- =============================================================================
