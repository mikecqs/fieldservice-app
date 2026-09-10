-- Migração para o projeto Supabase já em produção do orcamentos-app.
-- Corre isto uma vez no SQL Editor. Idempotente.
--
-- Dois estados novos depois de "aceite": "servico_realizado" e
-- "faturado" — um orçamento só fica mesmo concluído (estado final)
-- depois de marcado como faturado, nunca direto de aceite para faturado.

alter table budgets drop constraint if exists budgets_estado_check;
alter table budgets add constraint budgets_estado_check
  check (estado in ('rascunho', 'enviado', 'followup', 'aceite', 'servico_realizado', 'faturado', 'recusado', 'cancelado'));

alter table budget_events drop constraint if exists budget_events_tipo_check;
alter table budget_events add constraint budget_events_tipo_check
  check (tipo in ('criado', 'enviado', 'followup', 'aceite', 'servico_realizado', 'faturado', 'recusado', 'cancelado', 'duplicado'));
