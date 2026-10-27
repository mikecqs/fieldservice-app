-- 2026-10-27 — Já aplicada em produção (SQL Editor do Supabase).
--
-- Causa da agenda do técnico vazia: as 4 views seguras tinham sido mudadas
-- para security_invoker = true (aviso "Security Definer View" do Security
-- Advisor "corrigido"). Assim corriam com as permissões do técnico/
-- atendimento, que não têm SELECT nas tabelas base → 0 linhas, sem erro.
-- Estas views TÊM de correr com os privilégios do dono; a segurança vem do
-- filtro dentro de cada view (auth.uid() / my_org() / my_role()).
--
-- Verificação:
--   select relname, reloptions from pg_class
--   where relname like '%technician_view' or relname = 'requests_status_atendimento_view';

alter view public.services_technician_view          set (security_invoker = false);
alter view public.clients_technician_view           set (security_invoker = false);
alter view public.client_addresses_technician_view  set (security_invoker = false);
alter view public.requests_status_atendimento_view  set (security_invoker = false);
