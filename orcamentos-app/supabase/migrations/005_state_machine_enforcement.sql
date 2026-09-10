-- Migração para o projeto Supabase já em produção do orcamentos-app.
-- Corre isto uma vez no SQL Editor. Idempotente.
--
-- VULN-01 (auditoria de segurança): as regras de transição de estado e de
-- imutabilidade viviam só em lib/orcamento-estado.ts e nas Server Actions —
-- nunca na base de dados. Como a anon key + a sessão do próprio utilizador
-- estão sempre expostas no browser (é assim que o Supabase funciona por
-- desenho), um pedido direto à API do Supabase conseguia contornar
-- completamente essas regras. Esta migração move as invariantes críticas
-- para dentro do Postgres, via triggers — assim são verdadeiras mesmo que
-- alguém ignore por completo a app Next.js.
--
-- Princípio seguido: a app continua a facilitar/validar (lib/orcamento-
-- estado.ts + Server Actions ficam exatamente como estão, continuam a dar
-- mensagens de erro amigáveis antes de sequer chegar à base de dados), mas
-- agora é o PostgreSQL que impede mesmo as operações que violem as
-- invariantes, não só a UI/app.
--
-- Porque triggers e não RPCs SECURITY DEFINER para tudo: as Server Actions
-- já fazem `.update()`/`.insert()` diretos nas tabelas (não RPCs) — usar
-- triggers mantém esse código inalterado e cobre automaticamente QUALQUER
-- caminho de escrita (app, API direta, uma ferramenta de admin futura),
-- sem ter de lembrar cada novo caminho de chamar a RPC certa. Só onde é
-- preciso escrever em `budget_events` sem dar ao utilizador uma policy de
-- INSERT direta é que se usa SECURITY DEFINER (mesmo princípio "RPCs
-- SECURITY DEFINER para tudo o que é crítico" já seguido no Serv).

-- =============================================================================
-- 1. budgets — máquina de estados + imutabilidade, aplicada em BEFORE UPDATE
-- =============================================================================
--
-- Grafo de transições replicado 1:1 de lib/orcamento-estado.ts (fonte de
-- verdade = código existente, não o exemplo do pedido):
--
--   rascunho  → enviado | followup | aceite | recusado | cancelado
--   enviado   → followup | aceite | recusado | cancelado
--   followup  → followup (reajustar data) | aceite | recusado | cancelado
--   aceite    → servico_realizado | cancelado
--   servico_realizado → faturado | cancelado
--   faturado / recusado / cancelado → (terminais, nenhuma saída)
--
-- "enviado" nunca é hoje gravado como valor de estado por nenhuma Server
-- Action (marcarEnviado salta direto para "followup"), mas continua na
-- lista de estados-origem válidos em podeMarcarFollowup/podeAceitarOrcamento/
-- podeRecusarOrcamento — mantido aqui pela mesma razão.

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
  -- Depois de terminal, a linha fica congelada por completo — nenhuma
  -- coluna muda, nem estado nem qualquer outra (é a garantia de
  -- imutabilidade que a app promete para orçamentos faturados/recusados/
  -- cancelados).
  if old.estado = any(estados_terminais) then
    raise exception 'Orçamento em estado terminal (%) não pode ser alterado.', old.estado
      using errcode = '23514';
  end if;

  -- Mudança de estado: só para uma transição explicitamente permitida a
  -- partir do estado atual.
  if new.estado is distinct from old.estado then
    if not coalesce((transicoes_validas -> old.estado) ? new.estado, false) then
      raise exception 'Transição de estado inválida: % → %.', old.estado, new.estado
        using errcode = '23514';
    end if;
  end if;

  -- IVA só pode mudar enquanto o orçamento ainda está em rascunho — mesma
  -- regra de podeEditarItensOrcamento, replicada aqui para o valor não
  -- poder ser reescrito por fora da app depois de enviado ao cliente.
  if new.iva_percent is distinct from old.iva_percent and old.estado <> 'rascunho' then
    raise exception 'IVA só pode ser alterado enquanto o orçamento está em rascunho.'
      using errcode = '23514';
  end if;

  -- O número humano (ORC-XXXXXX) é gerado uma única vez pela sequência —
  -- nunca é editável depois de criado (mesmo princípio já seguido no Serv
  -- para CLI-XXXXXX/PED-XXXXXX).
  if new.numero is distinct from old.numero then
    raise exception 'O número do orçamento não pode ser alterado.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_enforce_transition on budgets;
create trigger budgets_enforce_transition
  before update on budgets
  for each row execute function enforce_budget_transition();

-- =============================================================================
-- 2. budget_events — deixa de ser gravável diretamente; passa a ser gerado
--    automaticamente a partir da própria mudança de estado em `budgets`.
-- =============================================================================
--
-- Antes: qualquer pedido autenticado da própria empresa conseguia inserir
-- um evento arbitrário (tipo restrito pelo CHECK, mas descricao livre) sem
-- que a ação descrita tivesse mesmo acontecido — "audit trail" fabricável.
--
-- Depois: a policy de INSERT é removida (RLS sem policy = ninguém insere
-- diretamente); só as duas funções SECURITY DEFINER abaixo — disparadas
-- sempre e só quando o `estado`/a criação de `budgets` mudam de verdade —
-- é que escrevem em budget_events. Um evento em budget_events passa a ser
-- prova de que a mudança de estado correspondente realmente aconteceu na
-- mesma transação, não uma alegação separada e forjável.

drop policy if exists "user inserts own budget events" on budget_events;

-- Nova coluna: liga um orçamento duplicado ao original, só para o trigger
-- de log conseguir escrever "Duplicado a partir do orçamento X" sem
-- precisar de um INSERT manual em budget_events feito pela app.
alter table budgets
  add column if not exists duplicado_de_id uuid references budgets (id) on delete set null;

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

drop trigger if exists budgets_log_created on budgets;
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
      -- marcarEnviado: salta direto de rascunho para followup, mas o
      -- evento registado é sempre "enviado" (é o que aconteceu de facto).
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
    -- Reajuste da data de follow-up sem mudar de estado (marcarFollowup
    -- chamado outra vez enquanto já está em "followup").
    insert into budget_events (budget_id, tipo, descricao)
    values (new.id, 'followup', 'Follow-up marcado para ' || coalesce(new.followup_em::text, '—') || '.');
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_log_state_change on budgets;
create trigger budgets_log_state_change
  after update on budgets
  for each row execute function log_budget_state_change();

-- =============================================================================
-- 3. budget_items — só editáveis enquanto o orçamento-pai está em rascunho
-- =============================================================================
--
-- Antes: só a Server Action verificava podeEditarItensOrcamento() antes de
-- inserir/apagar — um INSERT/UPDATE/DELETE direto em budget_items passava
-- pela RLS (que só verifica a empresa dona) sem nunca olhar para o estado
-- do orçamento.

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

drop trigger if exists budget_items_enforce_editable on budget_items;
create trigger budget_items_enforce_editable
  before insert or update or delete on budget_items
  for each row execute function enforce_budget_items_editable();

-- =============================================================================
-- 4. budget_templates — limite de 3 por empresa, seguro contra concorrência
-- =============================================================================
--
-- Antes: só criarModelo() verificava `count < 3` antes de inserir — dois
-- pedidos concorrentes (duplo clique, dois separadores) podiam ambos
-- passar a verificação e resultar em 4+ modelos (classic TOCTOU).
--
-- `perform ... for update` bloqueia a linha de `companies` da própria
-- empresa até este trigger terminar — dois inserts concorrentes da MESMA
-- empresa ficam serializados (o segundo espera o primeiro committar antes
-- de contar), sem precisar de Redis/lock externo. É suficiente para o
-- volume desta funcionalidade (cliques humanos, não alta concorrência).
--
-- O limite (3) tem de se manter sincronizado manualmente com
-- LIMITE_MODELOS em app/(app)/empresa/modelos/constantes.ts — não há
-- forma simples de partilhar uma constante entre TS e SQL sem introduzir
-- uma tabela de configuração só para isto, o que seria complexidade a
-- mais para um único número.

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

drop trigger if exists budget_templates_enforce_limit on budget_templates;
create trigger budget_templates_enforce_limit
  before insert on budget_templates
  for each row execute function enforce_template_limit();
