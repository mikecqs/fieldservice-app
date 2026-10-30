# Migrações da base de dados

Objetivo: **a produção nunca muda sem ficar registado no repositório.**
O incidente de 2026-10-27 (views alteradas à mão no Supabase, agenda do
técnico vazia) aconteceu precisamente porque a BD mudou fora do código.

## Os três ficheiros e o papel de cada um

| Ficheiro | Papel |
|---|---|
| `supabase/migrations/AAAAMMDD_NN_descricao.sql` | **Cada alteração à BD, a partir de 2026-10-27.** Um ficheiro por alteração, nunca editado depois de aplicado. |
| `supabase/schema.sql` | Fotografia completa e atual da BD (para recriar do zero). Atualizado **no mesmo commit** que cada migração. |
| `supabase/migration-production.sql` | Histórico **congelado** até 2026-10-27. Não acrescentar mais nada aqui. |

## Regra para qualquer alteração à BD (pessoas e sessões do Claude)

1. Criar `supabase/migrations/AAAAMMDD_NN_descricao.sql` (data + nº sequencial do dia).
2. Atualizar `supabase/schema.sql` com o mesmo efeito.
3. Abrir PR. Depois do merge, colar a migração no **SQL Editor** do Supabase.
4. No topo do ficheiro, registar `-- Já aplicada em produção (data)`.

**Nunca** alterar a BD diretamente no painel do Supabase (incluindo os botões
"corrigir" do Security Advisor) sem passar por estes passos. Em particular,
o aviso "Security Definer View" para as views seguras é **esperado** — ver
`20261027_01_views_security_invoker.sql`.
