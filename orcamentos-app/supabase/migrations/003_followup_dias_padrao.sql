-- Migração para o projeto Supabase já em produção do orcamentos-app.
-- Corre isto uma vez no SQL Editor. Idempotente.
--
-- Nova coluna: dias por omissão para o follow-up automático ao marcar um
-- orçamento como enviado, configurável por empresa (Empresa → Dados).

alter table companies
  add column if not exists followup_dias_padrao integer not null default 7;
