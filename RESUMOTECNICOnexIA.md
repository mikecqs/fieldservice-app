# RESUMO TÉCNICO — nexIA (fieldservice-app)

Documento de migração de sessão, gerado por análise read-only do repositório em
`C:\Users\Loja-2022\Desktop\fieldservice-app` em 2026-08-29. Nenhum ficheiro,
base de dados ou commit foi alterado para produzir este resumo.

---

## 1. Arquitetura atual da aplicação

Aplicação web multi-tenant (multi-empresa) de gestão de serviços técnicos no
terreno ("field service management"), com quatro áreas de utilizador
distintas por role: **Admin**, **Técnico**, **Finance** e **Super Admin**
(gestor de todas as empresas/tenants).

- **Frontend + Backend unificados** em Next.js 14 (App Router), com Server
  Components para leitura de dados e Server Actions para mutações — não há
  uma API REST/GraphQL separada além de algumas rotas `/api/*` específicas
  para OAuth e webhooks (ver secção 3).
- **Base de dados**: Supabase (Postgres gerido), com toda a lógica de negócio
  crítica implementada como funções SQL `SECURITY DEFINER` (RPCs) chamadas a
  partir do backend — nunca confiando em validação só do lado do cliente.
- **Multi-tenant por Row Level Security (RLS)**: cada tabela tem
  `organization_id`, e a segregação entre empresas é garantida pela BD, não
  pela aplicação. Isto é tratado como a fronteira de segurança real do
  sistema.
- **Sincronização assíncrona orientada a eventos**: duas integrações
  (Google Sheets e notificações Push) usam triggers Postgres +
  `pg_net`/`pg_cron` para reagir a mudanças quase em tempo real sem precisar
  de um servidor sempre ligado — o Next.js corre em Vercel (serverless).
- **Deploy**: Vercel (produção), GitHub como origem do código.

---

## 2. Stack utilizada

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14.2.15 (App Router, Server Components + Server Actions) |
| Linguagem | TypeScript (strict mode) |
| UI | React 18.3, Tailwind CSS 3.4 (tema escuro nexIA — ver secção 10) |
| Gráficos | Recharts 3.10 (só usado na página de Relatórios) |
| Base de dados | Supabase (Postgres) — `@supabase/ssr` + `@supabase/supabase-js` |
| Autenticação | Supabase Auth (email/password + recuperação de password) |
| PDF | `pdf-lib` (geração de PDF de orçamentos) |
| Excel | `xlsx` (SheetJS) — exportações no Dashboard Financeiro e Relatórios |
| Push notifications | `web-push` (Web Push/VAPID) + Service Worker nativo |
| Hosting | Vercel (deployment + Cron Jobs) |
| Repositório | GitHub — `https://github.com/mikecqs/fieldservice-app` |

Não há Redis, filas externas, nem containers — tudo corre em Postgres
(triggers/cron) + funções serverless da Vercel.

---

## 3. Estrutura de pastas e ficheiros importantes

```
app/
  admin/                    → área do Admin (role ADMIN/SUPER_ADMIN com acesso a empresa)
    AdminSidebar.tsx
    layout.tsx              → gate de role (requireRole)
    dashboard/page.tsx
    agenda/                 → calendário (dia/semana/mês) com popup de criação/edição
      page.tsx, AgendaClient.tsx, ServicoModal.tsx, actions.ts
    atencao/page.tsx        → "Central de Atenção" — pendências operacionais
    clientes/               → CRUD clientes + moradas + equipamentos
    pedidos/                → pedidos (requests) + decisão orçamento/agendamento
    orcamentos/             → orçamentos (budgets) + PDF + follow-up automático
    servicos/               → OS (services) — ficha completa, agendamento, validação
    compras/                → gestão de compras de materiais (purchases)
    materiais/page.tsx      → materiais pendentes → compra rápida
    catalogo/               → catálogo de materiais (import Excel)
    faturacao/              → validação/faturação (partilhado com Finance)
    financeiro/page.tsx     → Dashboard Financeiro (ver lib/financeiro.ts)
    relatorios/page.tsx     → página de Relatórios (nova, ver secção 4)
    configuracoes/          → definições da empresa + Integrações (Google Sheets)
    utilizadores/           → gestão de utilizadores da empresa
  financeiro/               → área da role FINANCE (só leitura/faturação)
  tecnico/                  → área do Técnico (mobile-first)
    page.tsx                → agenda do técnico + alerta de atraso + push
    AtivarNotificacoes.tsx, push-actions.ts
    servico/[id]/           → ficha do serviço (fecho de OS, materiais, mão de obra)
  super-admin/              → gestão de empresas/tenants (role SUPER_ADMIN)
  login/, esqueci-password/, redefinir-password/  → autenticação
  api/
    integrations/google-sheets/{connect,callback,process}/route.ts
    push/check-delays/route.ts
  layout.tsx, page.tsx, globals.css

lib/
  supabase/{client,server}.ts   → clientes Supabase (browser / server / admin-service-role)
  auth.ts                       → requireRole, getOrgId, homeForRole
  financeiro.ts                 → motor central de estatísticas (getFinanceiroStats)
  relatorios.ts                 → estatísticas adicionais para a página de Relatórios
  agenda-dates.ts, preparacao.ts, pedido-estado.ts, orcamento.ts, service-events.ts,
  budget-events.ts              → utilitários de domínio
  google-sheets/                → OAuth, cliente REST Sheets API, motor de sincronização

components/
  DashboardFinanceiro.tsx, ExportarFinanceiroExcel.tsx, PainelFaturacao.tsx, NexiaMark.tsx
  relatorios/                   → gráficos e tabela da página de Relatórios

supabase/schema.sql             → FONTE DE VERDADE do schema (1392 linhas) — todas as
                                   migrações aplicadas diretamente na BD foram também
                                   replicadas aqui manualmente (ver secção 12)

public/
  sw.js                         → Service Worker (Web Push)
  manifest.json                 → PWA manifest (para "Adicionar ao ecrã principal")
  icon.svg                      → logótipo nexIA (favicon/ícone)

middleware.ts                   → gate de sessão por cookie (ver secção 7)
vercel.json                     → Vercel Cron (varredura de recuperação do Sheets)
```

---

## 4. Funcionalidades já implementadas e testadas

Tudo o que está listado aqui foi implementado **e** verificado nesta sessão
(testes ao nível de RPC/BD com dados reais, e/ou renderização SSR real —
ver secção 12 para a limitação conhecida sobre testes visuais/browser).

- **Gestão completa de Clientes** — CRUD, várias moradas por cliente,
  equipamentos associados com histórico de intervenções.
- **Pedidos (requests)** — criação com tipo (Agendamento/Orçamento/
  Manutenção/Instalação/configurável por empresa); fluxo correto por tipo:
  "Agendamento" e "Orçamento" seguem diretamente; "Manutenção"/"Instalação"
  perguntam "é necessário orçamento?".
- **Orçamentos (budgets)** — criação, itens (materiais/mão de obra/
  deslocação/outros), cálculo automático (subtotal/IVA/total), geração de
  PDF, **follow-up automático a 7 dias** quando marcado como "Enviado"
  (estado passa a `aguarda_resposta`, evento gravado, aparece na Central de
  Atenção), histórico completo (`budget_events`).
- **Serviços/OS (services)** — máquina de estados quase totalmente
  automática (`por_agendar → agendado → em_curso → aguarda_validacao →
  concluido/faturado`, mais `nova_visita`, `nao_realizado`,
  `correcao_necessaria`, `cancelado`); prioridade; associação a
  cliente/pedido/orçamento/equipamento.
- **Agenda (Admin)** — calendário dia/semana/mês com grelha horária; clicar
  num serviço agendado ou numa slot vazia abre um **popup** (não navega) para
  ver/editar ou criar+agendar um serviço novo/existente, com aviso de
  conflito de agenda não-bloqueante (mesmo técnico, horário sobreposto).
- **Fecho de OS pelo Técnico** — checklist por tipo de serviço (Manutenção
  vs. Instalação), mão de obra obrigatória (menu fixo de durações), cálculo
  automático de materiais (qtd × preço) + mão de obra (horas × taxa/hora da
  empresa) = valor total do serviço, distinção clara entre "material
  previsto" e "material utilizado" (nunca fundidos), fluxo "Nova visita"
  (agenda direta se já há data combinada, ou pendência para o Admin) e "Não
  foi possível realizar" (nunca apaga a tentativa).
- **Validação administrativa** — Admin (ou Finance) valida ou rejeita um
  serviço concluído; rejeição exige motivo; serviço rejeitado volta ao
  técnico como `correcao_necessaria`; nunca apaga o histórico anterior;
  técnico nunca pode validar o próprio serviço (bloqueado na RPC, não só na
  UI).
- **Visibilidade do Técnico (segurança)** — vê detalhes completos (morada,
  contacto, botão Chamar, Google Maps, materiais previstos) do serviço
  **atual** e do **seguinte**; a partir do 2º seguinte só vê hora+cliente.
  Corrigido nesta sessão para também aplicar a regra corretamente a serviços
  em `nova_visita`/`correcao_necessaria` (bug antigo expunha dados nesses
  casos — ver secção 11).
- **Alerta de atraso (in-app + Push)** — quando o técnico está num serviço
  em curso e o próximo começa em ≤30 min, mostra aviso na app **e** envia
  notificação Web Push (ver secção 9 — infraestrutura completa, dedup
  garantido).
- **Compras de materiais** — evita duplicados (verificação sempre no
  servidor, sobrevive a reload), associada a serviço/cliente.
- **Faturação** — validado → faturado, com referência/valor/data; dashboards
  para ADMIN e FINANCE (role dedicada, só leitura + as 3 mutações de
  faturação, sem gestão de utilizadores/configurações).
- **Dashboard Financeiro** (`/admin/financeiro` e `/financeiro`) —
  faturação, produção, tempos médios (7 transições: pedido→orçamento,
  pedido→agendamento, agendamento→início, início→fecho, fecho→validação,
  validação→faturação, pedido→faturação), valores (mão de obra/materiais/
  deslocação), filtros de período (hoje/semana/mês/ano/personalizado),
  exportação Excel.
- **Página de Relatórios** (`/admin/relatorios`, nova) — 6 cartões
  principais com comparação ao período anterior, Pontos de Atenção
  (resumo complementar, não duplica a Central), Evolução (gráfico de linha),
  Técnicos (tabela), Tipos de serviço (gráfico+lista), Orçamentos (funil/
  donut), Financeiro, Materiais (previsto vs. utilizado), Agenda (ocupação —
  "horas disponíveis" é uma estimativa assinalada como tal), tabela
  detalhada com pesquisa/filtro/ordenação/paginação, exportação Excel em 3
  modos (atual/todos/dados detalhados).
- **Autenticação** — login, **recuperação de password** completa (pedido
  neutro "se existir conta...", link seguro via Supabase Auth, definição de
  nova password, ecrã de sucesso premium com ícone), logout.
- **Notificações Push (Web Push)** — VAPID, Service Worker, subscrição por
  técnico (com deteção de iOS não-instalado como PWA), verificação a cada
  minuto via `pg_cron` do risco de atraso, envio via `web-push`, dedup
  atómico (nunca notifica o mesmo serviço duas vezes).
- **Integração Google Sheets** — OAuth por empresa (scope mínimo
  `spreadsheets`), criação automática do Sheet com 12 folhas, sincronização
  quase-tempo-real orientada a eventos (triggers → fila → webhook, com
  varredura de recuperação via Vercel Cron), isolamento total por empresa
  (testado), nunca escreve de volta para a nexIA. **Bloqueada em produção
  até o Admin criar a app OAuth no Google Cloud Console** — ver secção 5.
- **Redesign visual completo** — identidade minimalista escura (preto/
  branco/cinzentos), logótipo nexIA (monograma geométrico), aplicado
  consistentemente em toda a app; bug de contraste (texto branco sobre
  fundo branco em formulários) corrigido globalmente via `globals.css`.
- **Rebrand nexIA** — nome e identidade visual em toda a app.

---

## 5. Funcionalidades ainda não implementadas (ou bloqueadas)

- **Google Sheets — ainda não testável de ponta a ponta**: falta o Admin
  criar a app OAuth no Google Cloud Console (projeto, consent screen,
  Client ID/Secret) e configurar `GOOGLE_SHEETS_CLIENT_ID` /
  `GOOGLE_SHEETS_CLIENT_SECRET` no Vercel — **confirmado nesta sessão que
  estas duas variáveis ainda NÃO estão definidas em produção** (`vercel env
  ls production` não as lista). Todo o código está pronto e testado ao
  nível de isolamento/fila/falhas, mas o fluxo real "Ligar → autorizar →
  Sheet criado → dados sincronizados" nunca correu de ponta a ponta.
- **Verificação visual/interativa em browser real** — em várias sessões
  recentes a ferramenta de browser esteve indisponível/instável neste
  ambiente (pane sem compositar, navegação intermitente). Isto significa
  que funcionalidades novas (popup da agenda, gráficos de Relatórios,
  botões de exportação, layout mobile) foram testadas ao nível de
  dados/SSR mas **não** por cliques reais num browser. Recomenda-se validar
  visualmente antes de considerar 100% fechado.
- **Estatísticas avançadas do Google Sheets** — a folha "Estatísticas" e o
  "Dashboard" do Sheet cobrem os indicadores principais (reaproveitando
  `getFinanceiroStats`), mas não implementam TODAS as estatísticas possíveis
  listadas em pedidos anteriores (ex: fórmulas nativas do Sheets com
  período totalmente arbitrário editável pela chefia diretamente na folha —
  ficou como 3 períodos fixos pré-calculados: Hoje/Este mês/Este ano).
- **"Horas disponíveis" na Agenda (Relatórios)** é uma estimativa (nº
  técnicos × dias × 8h) — não existe configuração real de capacidade/turnos
  no sistema. Se se quiser um número real, é preciso criar essa
  configuração (não existe ainda).
- **Materiais previsto vs. utilizado** é casado por **nome de texto**, não
  por chave estrangeira — não há ligação forte entre
  `service_materials_planned` e `visit_materials_used`/`catalog_items`. Se
  os nomes não baterem certo (erros de digitação, variações), a comparação
  falha silenciosamente.
- **Sem testes automatizados (unit/integration/e2e)** no repositório — toda
  a verificação feita até agora foi manual/scripted ad-hoc contra a BD real
  via scripts temporários (nunca commitados).
- **Sem CI/CD configurado** além do deploy manual via `vercel --prod`
  (não há GitHub Actions nem deploy automático no push — confirmado: o
  Vercel não está ligado ao repositório para deploy automático, ver `vercel
  git connect` sugerido pela própria CLI).
- **Sem CLAUDE.md** no repositório — não há ficheiro de instruções
  persistentes para uma sessão futura do Claude Code; este resumo pode servir
  de base para criar um.

---

## 6. Estrutura da base de dados Supabase — tabelas, relações e RLS

Fonte de verdade: `supabase/schema.sql` (1392 linhas). Todas as tabelas têm
RLS ativo. Padrão geral: `organization_id = my_org()` + `my_role() in
(...)` nas policies; duas funções auxiliares `SECURITY DEFINER` (`my_org()`,
`my_role()`, `is_super_admin()`) evitam recursão de RLS.

### Tabelas de identidade/tenant
- `organizations` (id, nome)
- `profiles` (id → auth.users, organization_id, role: SUPER_ADMIN/ADMIN/
  TECHNICIAN/FINANCE, nome, email) — `organization_id` pode ser null só
  para SUPER_ADMIN.
- `org_settings` (organization_id PK, tipos_servico text[], followup_dias_default,
  valor_hora_mao_obra) — criada automaticamente via trigger
  `on_organization_created` sempre que nasce uma empresa.

### Clientes
- `clients` (id, organization_id, nome, empresa, nif, telefone, email, notas)
- `client_addresses` (id, organization_id, client_id, label, endereco)
- `client_equipment` (id, organization_id, client_id, address_id, equipamento, marca, ...)

### Pedidos → Orçamentos
- `requests` (id, organization_id, client_id, tipo, descricao, origem,
  info_falta, estado: novo/orcamento/convertido/arquivado)
- `budgets` (id, organization_id, client_id, request_id, estado:
  rascunho/enviado/aguarda_resposta/followup/aceite/recusado/cancelado,
  criado_em, enviado_em, followup_em, service_id, iva_percent, numero
  sequencial)
- `budget_items` (id, budget_id, organization_id, tipo:
  materiais/mao_obra/deslocacao/outros, qtd, valor_unit)
- `budget_events` (histórico imutável — criado/enviado/followup/aceite/
  recusado/cancelado)

### Catálogo
- `catalog_items` (id, organization_id, referencia, descricao, preco_venda)
  — importado de Excel.

### Serviços/OS
- `services` (id, organization_id, client_id, address_id, request_id,
  budget_id, equipment_id, tipo, descricao, prioridade, data_agendada,
  hora_agendada, hora_fim_agendada, notas, estado — 9 valores possíveis
  (ver secção 4), valor, faturacao_estado, faturacao_data/valor/
  referencia/utilizador)
- `service_technicians` (service_id, user_id) — tabela de junção N:N
- `service_materials_planned` (id, service_id, nome, qtd) — **sem preço**
- `service_events` (histórico imutável — 11 tipos de evento, nunca apagado)
- `service_validations` (id, service_id, acao: validado/rejeitado, motivo,
  utilizador)

### Visitas (uma OS pode ter várias)
- `visits` (id, organization_id, service_id, data, hora_inicio_real,
  hora_fim_real, trabalho_realizado, resultado, mao_obra_tipo — enum fixo
  de durações, problema_identificado/equipamento_instalado/
  quantidade_instalada/testes_realizados — campos condicionais por tipo,
  valor_calculado, created_by)
- `visit_materials_used` (id, visit_id, nome, qtd, **preco_unit** — preço
  à data de uso, não o preço atual do catálogo)
- `visit_photos` (id, visit_id, storage_path)

### Compras
- `purchases` (id, organization_id, descricao, fornecedor, estado, service_id)
- `purchase_items` (id, purchase_id, nome, qtd)

### Integração Google Sheets
- `google_sheets_integrations` (organization_id PK, status:
  desligado/ativo/erro, spreadsheet_id/url, google_email, **refresh_token**
  — coluna com `revoke select ... from authenticated, anon` — só o
  service_role a lê, last_synced_at, last_error)
- `google_sheets_sync_queue` (fila de sincronização — entity_type,
  entity_id, action upsert/delete, status pending/done/failed, attempts)
- `google_sheets_row_map` (organization_id, sheet_name, entity_id →
  row_number, para upsert idempotente sem duplicar linhas)

### Notificações Push
- `push_subscriptions` (id, user_id, organization_id, endpoint único,
  p256dh, auth) — RLS: só o próprio técnico gere as suas subscrições.
- `tech_delay_notifications` (service_id PK — usada como *guarda atómica*
  de dedup: o insert falha se já existir, garantindo notificação única)

### Views seguras para o Técnico (SECURITY DEFINER, filtram por auth.uid())
- `services_technician_view` — expõe `descricao`/notas condicionalmente a
  `tech_service_detalhes_visiveis(service_id)`; sempre mostra
  cliente_nome/hora; `desbloqueado` vem de `tech_service_desbloqueado(id)`.
- `clients_technician_view`, `client_addresses_technician_view` — só dados
  operacionais (nunca financeiros).

### Extensões ativas
- `pg_net` (chamadas HTTP assíncronas a partir de triggers — usado por
  ambas as integrações).
- `pg_cron` (agendamento de jobs Postgres — `tech-delay-check`, a cada
  minuto, ver secção 9).

### Storage
- Bucket `equipamentos` (fotos de equipamentos do cliente) — path sempre
  `{organization_id}/...`, policy restrita a ADMIN/SUPER_ADMIN da própria
  empresa.

---

## 7. Sistema de autenticação e permissões

- **Auth**: Supabase Auth (email + password), sessão via cookies
  (`@supabase/ssr`, `createServerClient`), cookie `sb-{ref}-auth-token`.
- **4 roles**: `SUPER_ADMIN` (gere todas as empresas, sem organization_id
  obrigatório), `ADMIN` (gestão completa da própria empresa), `TECHNICIAN`
  (acesso restrito às próprias OS via views seguras), `FINANCE` (só leitura
  + faturação, sem gestão de utilizadores/configurações/operação técnica).
- **`middleware.ts`** — portão leve: só verifica a **existência** do cookie
  de sessão (sem chamar a rede, por limitação do sandbox de Edge Runtime
  nesta máquina — comentário explícito no código). Redireciona para
  `/login` se não houver cookie, exceto: `/login`, `/esqueci-password`,
  `/redefinir-password` (rotas públicas), `/api/*` (tratam a própria auth),
  `sw.js`/`manifest.json` (pedidos estáticos do browser, corrigido nesta
  sessão depois de um bug que os bloqueava).
- **Validação real de role** acontece nos `layout.tsx` de cada área
  (`app/admin/layout.tsx`, `app/tecnico/layout.tsx`, `app/super-admin/
  layout.tsx`) via `requireRole([...])` em `lib/auth.ts`, que corre em
  Node.js normal (não Edge) — chama `supabase.auth.getUser()` e lê
  `profiles.role`.
- **`getOrgId()`** (`lib/auth.ts`) — usado em todas as Server Actions do
  Admin para saber a empresa; nunca vem do formulário (mesmo que forjado,
  a RLS rejeitaria).
- **Barreira real de segurança = RLS**, não a UI. Todas as tabelas
  filtram por `organization_id = my_org()`. Isolamento entre empresas
  testado explicitamente nesta sessão (Google Sheets, visibilidade do
  técnico).
- **Recuperação de password**: `supabase.auth.resetPasswordForEmail()` +
  `redirectTo` para `/redefinir-password`; mensagem sempre neutra (nunca
  revela se o email existe); a página de redefinição usa
  `supabase.auth.updateUser({password})` após validar a sessão de
  recuperação.

---

## 8. Fluxos atuais: Cliente → Pedido → Orçamento → Serviço → Agenda → Técnico → Faturação

```
Cliente (clients)
  └─ Pedido (requests) — tipo escolhido no formulário:
       ├─ "Orçamento"    → cria budget automaticamente, sem perguntar nada
       ├─ "Agendamento"  → cria service diretamente (por_agendar), sem perguntar nada
       └─ "Manutenção"/"Instalação"/outro → pergunta "é necessário orçamento?"
            ├─ Sim → cria budget (mesmo caminho que "Orçamento")
            └─ Não → cria service diretamente (mesmo caminho que "Agendamento")

Orçamento (budgets, se aplicável)
  ├─ Rascunho → Admin adiciona items (materiais/mão de obra/deslocação)
  ├─ "Marcar como enviado" → estado=aguarda_resposta, followup_em=+7 dias,
  │    evento gravado, aparece na Central de Atenção quando vence
  └─ Aceite → cria service (services.budget_id ligado) | Recusado/Cancelado → fim

Serviço/OS (services) — estado inicial: por_agendar
  ├─ Admin agenda (data/hora início/hora fim, técnico) → estado=agendado
  │    (via página de Serviço OU via popup da Agenda — ambos os caminhos
  │    convergem nas mesmas Server Actions)
  ├─ Técnico inicia (tech_start_service RPC) → estado=em_curso
  │    (só pode iniciar se "desbloqueado" — serviço anterior fechado)
  └─ Técnico fecha (tech_finish_visit RPC):
       ├─ "Concluído" → estado=aguarda_validacao
       │    (calcula valor = materiais×preço + mão_obra_horas×taxa_hora)
       │    Admin/Finance "Validar" → estado permanece concluído/válido → faturação
       │    Admin/Finance "Mandar para trás" (motivo obrigatório) →
       │        estado=correcao_necessaria → volta ao técnico → pode fechar de novo
       ├─ "Nova visita" → se já há data combinada: reagenda o MESMO serviço
       │    (estado=nova_visita, nova data/hora); senão: fica pendente de
       │    agendamento (aparece na Central de Atenção)
       └─ "Não foi possível realizar" → estado=nao_realizado (nunca apaga a
            visita/tentativa)

Faturação
  └─ services.faturacao_estado: por_faturar → faturado
       (finance_marcar_faturado RPC — Admin ou Finance, nunca o técnico)
```

Todo o percurso fica gravado em `service_events`/`budget_events`/
`service_validations` (histórico imutável, nunca apagado) — é o que
alimenta os "Tempos médios" no Dashboard Financeiro/Relatórios e a folha
"Histórico" do Google Sheets.

---

## 9. Server Actions, RPCs e componentes importantes

### RPCs Postgres (SECURITY DEFINER, chamadas via `supabase.rpc(...)`)
- `tech_start_service(p_service_id)` — técnico inicia um serviço.
- `tech_finish_visit(p_visit_id, p_resultado, ...)` — fecho de OS pelo
  técnico; valida checklist obrigatório por tipo; calcula valor; nunca
  confia no cliente para o valor final.
- `finance_validar_servico(p_service_id)`, `finance_rejeitar_servico(...)`,
  `finance_marcar_faturado(...)` — só ADMIN/SUPER_ADMIN/FINANCE.
- `tech_service_detalhes_visiveis(p_service_id)`, `tech_service_desbloqueado(...)`
  — regras de visibilidade/desbloqueio do técnico (usadas pelas views).
- `enqueue_sheets_sync(...)`, `notify_sheets_sync*()` — infraestrutura da
  sincronização Google Sheets (triggers).

### Server Actions principais (por área)
- `app/admin/pedidos/actions.ts` — `criarPedido` (com a lógica de tipo),
  `decidirComOrcamento`/`decidirSemOrcamento`, `criarServicoDePedido`
  (helper partilhado), `resolverInfoPedido`, `arquivarPedido`.
- `app/admin/orcamentos/actions.ts` — CRUD de orçamentos, `marcarEnviado`
  (follow-up automático), `aceitarOrcamento`, `avancarEstado`.
- `app/admin/servicos/actions.ts` — `criarServico`, `atualizarAgendamento`,
  `verificarConflitoAgenda` (aceita `serviceId` OU `technicianIds`
  diretamente — estendido nesta sessão para suportar o popup da agenda),
  `atribuirTecnico`/`removerTecnico`, `validarServico`,
  `enviarParaCorrecao`.
- `app/admin/agenda/actions.ts` — `criarOuAgendarNoPopup` (ação única que
  cobre os dois modos do popup: agendar existente ou criar+agendar novo).
- `app/tecnico/actions.ts` — `obterVisitaAberta`, `iniciarServico`,
  `concluirVisita`.
- `app/tecnico/push-actions.ts` — `subscreverPush`, `cancelarSubscricaoPush`.
- `app/admin/configuracoes/integracoes-actions.ts` — `sincronizarAgora`,
  `desligarGoogleSheets` (revoga o token na Google + limpa localmente).

### Rotas `/api/*` (fora do middleware de sessão)
- `api/integrations/google-sheets/connect` (GET) — inicia OAuth.
- `api/integrations/google-sheets/callback` (GET) — troca código, cria o
  Sheet, guarda a integração.
- `api/integrations/google-sheets/process` (POST com segredo
  `SHEETS_SYNC_SECRET` / GET com `CRON_SECRET`) — processa a fila de
  sincronização (chamado pelo trigger `pg_net` e pelo Vercel Cron diário
  de recuperação).
- `api/push/check-delays` (POST com segredo `PUSH_CHECK_SECRET`) — chamado
  pelo `pg_cron` a cada minuto; deteta risco de atraso e envia Web Push.

### Componentes/bibliotecas de domínio importantes
- `lib/financeiro.ts` — `getFinanceiroStats(supabase, desde, ate,
  organizationId?)` — motor central de estatísticas, reutilizado por
  Dashboard Financeiro, exportação Excel, Relatórios e folha Estatísticas
  do Google Sheets. O parâmetro `organizationId` só é necessário quando
  chamado com um cliente service-role (bypassa RLS).
- `lib/relatorios.ts` — estatísticas adicionais específicas da página de
  Relatórios (pontos de atenção, evolução, técnicos, tipos de serviço,
  funil de orçamentos, materiais, agenda).
- `lib/google-sheets/` — `sheets-api.ts` (OAuth + REST Sheets API mínimo,
  sem SDK `googleapis`), `build.ts` (cria o spreadsheet), `rows.ts`
  (shaping de cada entidade → linha da folha, sempre filtrado por
  organization_id), `process-queue.ts` (orquestrador da fila), `stats.ts`
  (escreve Dashboard/Estatísticas do Sheet).
- `components/DashboardFinanceiro.tsx` / `ExportarFinanceiroExcel.tsx` —
  padrão reutilizado (props → workbook → sheets) para a exportação de
  Relatórios (`ExportarRelatoriosExcel.tsx`).
- `components/relatorios/TabelaServicos.tsx` — única tabela com pesquisa/
  ordenação/paginação client-side do projeto (construída de raiz — não
  havia nenhum componente de tabela reutilizável antes).

---

## 10. Decisões de arquitetura já tomadas nesta conversa

1. **RLS é a fronteira de segurança**, nunca a UI — reforçado
   explicitamente em cada nova feature (ex: `revoke select (refresh_token)`
   a nível de coluna no Google Sheets, filtros explícitos de
   `organization_id` em todo o código que usa o cliente service-role).
2. **`SECURITY DEFINER` + validação sempre no servidor** para qualquer
   regra de negócio crítica (fecho de OS, validação, faturação) — nunca
   confiar em JS do cliente para valores monetários ou transições de
   estado.
3. **Histórico é sempre imutável e aditivo** — nunca UPDATE/DELETE em
   `service_events`/`budget_events`/`service_validations`; eliminações de
   outras entidades marcam "Eliminado" em vez de apagar (Google Sheets).
4. **Sincronização orientada a eventos com fila resiliente**, não polling
   síncrono: trigger Postgres → insere na fila (nunca falha) → tenta
   `pg_net.http_post` imediato (best-effort) → cron de recuperação apanha o
   que falhou. Usado tanto para Google Sheets como para Push Notifications.
5. **`pg_cron` em vez de Vercel Cron para tarefas frequentes** — Vercel
   Cron (plano atual) só permite frequência diária; `pg_cron` no Postgres
   corre a cada minuto sem essa limitação, e já está habilitado no projeto.
6. **URLs/segredos de webhook embutidos diretamente no código SQL da
   função** (não `ALTER DATABASE ... SET`) — o role usado na ligação via
   pooler não tem permissão de superuser no Postgres gerido do Supabase
   para `ALTER DATABASE`.
7. **Reutilizar lógica de estatísticas em vez de duplicar** — `lib/
   financeiro.ts` é a única fonte de verdade para tempos/produção/
   faturação, reutilizada por 4 consumidores diferentes (dashboard, Excel,
   Relatórios, Google Sheets).
8. **`getFinanceiroStats` aceita `organizationId` opcional** — só usado
   quando o chamador é um cliente service-role (bypassa RLS); com o
   cliente normal (sessão do utilizador) a RLS já filtra, o parâmetro é
   omitido.
9. **Scope OAuth mínimo para o Google Sheets** — só `spreadsheets` (não
   `drive`/`drive.file`), porque a própria Sheets API v4 já cria ficheiros
   novos sem precisar de acesso ao Drive.
10. **Redesign visual**: tema escuro (preto/branco/cinzentos), sem
    azul/índigo dominante; botões primários brancos com texto escuro;
    logótipo nexIA = monograma geométrico (não usa a palavra "cérebro"/
    símbolo de IA clichê).
11. **Materiais previsto vs. utilizado sempre distintos** — nunca fundidos
    numa única quantidade; a diferença fica sempre visível/registada.
12. **Mobile do Técnico é prioridade máxima** em qualquer decisão de UX.

---

## 11. Problemas que já foram resolvidos

- **Bug crítico de contraste**: formulários com texto branco sobre fundo
  branco em toda a app (o tema escuro definia `color: inherit` mas nunca um
  fundo escuro nos campos) — corrigido com uma única regra global em
  `app/globals.css`.
- **Bug de segurança na visibilidade do técnico**: um serviço em
  `nova_visita`/`correcao_necessaria` na 3ª+ posição da fila expunha
  morada/contacto/materiais previstos por engano — a função SQL
  `tech_service_detalhes_visiveis` só tratava `agendado`/`em_curso` como
  "fila ativa"; corrigida e testada (antes/depois) nesta sessão.
- **Bug do fluxo "Novo Pedido"**: tipo "Agendamento" seguia incorretamente
  para a pergunta "é necessário orçamento?" — corrigido com um caminho
  direto, partilhando lógica com `decidirSemOrcamento` via novo helper
  `criarServicoDePedido`.
- **Dois bugs de `middleware.ts` encontrados ao construir novas
  funcionalidades**: (1) qualquer rota `/api/*` era apanhada pelo portão de
  sessão-por-cookie, porque esta foi a primeira rota de API de todo o
  projeto — corrigido excluindo `/api/*` do matcher; (2) `sw.js` e
  `manifest.json` (pedidos estáticos do browser antes de existir sessão)
  também eram bloqueados, partindo silenciosamente as notificações push —
  corrigido.
- **Botão "Confirmar" sem ação no fecho de OS mobile** (sessão anterior) —
  causado por um `visitaAbertaId` desatualizado; corrigido com uma
  rede de segurança que vai sempre buscar a visita aberta real à BD antes
  de submeter.
- **Bug de overload ambíguo em `tech_finish_visit`** (recorrente em sessões
  anteriores, sempre que a assinatura da função mudava) — regra aprendida:
  `CREATE OR REPLACE FUNCTION` muda a identidade da função quando a lista
  de parâmetros muda; é preciso `DROP FUNCTION` explícito com a assinatura
  antiga primeiro.
- **Script de redesign de cores com bug próprio** (sessão anterior) — uma
  primeira versão do script de conversão de classes Tailwind corrompia
  botões primários (`bg-white` reescrito para `bg-neutral-900` numa
  segunda passagem); corrigido com uma técnica de "sentinelas" (3 passagens
  em vez de 2).
- **`ALTER DATABASE ... SET` sem permissão** no Postgres gerido do
  Supabase — contornado embutindo URL/segredo diretamente no corpo da
  função SQL em vez de usar GUCs customizados.

---

## 12. Problemas conhecidos ou pontos a verificar

- **`app/page.tsx` tem lógica de redirect duplicada e incompleta**: em vez
  de reutilizar `homeForRole()` de `lib/auth.ts` (que já trata
  corretamente as 4 roles, incluindo FINANCE → `/financeiro`), tem a sua
  própria lógica que só trata SUPER_ADMIN/ADMIN e manda **tudo o resto**
  (incluindo utilizadores FINANCE) para `/tecnico`. Isto é um bug real
  ainda não corrigido — um utilizador FINANCE que aceda à raiz do site é
  mal-encaminhado. **Detetado nesta análise, mas não corrigido** (o pedido
  do utilizador foi só para produzir este resumo, sem alterar código).
- **Google Sheets — não testado de ponta a ponta em produção** (falta
  Client ID/Secret do Google Cloud Console — ver secção 5).
- **Ferramenta de browser instável nesta sessão/ambiente** — múltiplas
  tentativas de verificação visual (pane sem compositar, viewport 0×0,
  navegação intermitente mesmo contra `127.0.0.1`) falharam de forma
  consistente em pelo menos 3 blocos de trabalho distintos. Isto é reportado
  como uma limitação do ambiente/ferramenta, não da aplicação — mas
  significa que nenhuma verificação visual/de cliques reais foi feita
  para: popup da agenda, gráficos de Relatórios, exportação Excel (o
  ficheiro é gerado client-side, nunca confirmado visualmente que abre bem
  no Excel), responsividade mobile real.
- **Materiais previsto vs. utilizado casados por nome de texto** — sem
  chave estrangeira partilhada; nomes que não batam certo (typos,
  variações de catálogo) fazem a comparação falhar silenciosamente.
- **"Horas disponíveis" na Agenda dos Relatórios é uma estimativa**,
  claramente assinalada na UI como tal, mas vale a pena confirmar com o
  cliente se é aceitável ou se precisa de uma configuração real de
  capacidade/turnos.
- **Vulnerabilidades de dependências conhecidas e não corrigidas**:
  `npm audit` reporta 3 vulnerabilidades (1 crítica em `next@14.2.15`,
  1 alta em `postcss` transitivo, 1 alta em `xlsx` sem correção
  disponível). Atualizar o Next.js para a versão corrigida implica uma
  mudança "breaking" (`next@16.x`) — decisão deliberadamente adiada nesta
  sessão por não ter sido pedida e implicar risco de regressão maior do
  que o âmbito dos pedidos feitos.
- **Sem testes automatizados** — toda a verificação depende de scripts
  manuais ad-hoc contra a BD real (nunca commitados) e leitura cuidadosa de
  código. Uma nova sessão não tem uma suite de regressão para correr.
- **Vercel não está ligado ao GitHub para deploy automático** — todos os
  deploys desta sessão foram feitos manualmente via `vercel --prod --yes`
  depois do `git push`. Se isto não for intencional, `vercel git connect`
  resolve.
- **`GOOGLE_SHEETS_CLIENT_ID`/`GOOGLE_SHEETS_CLIENT_SECRET`** só existem
  (vazios) em `.env.local` local — **não estão no Vercel** (confirmado
  nesta análise via `vercel env ls production`).

---

## 13. Estado atual do deployment/Vercel

- **Projeto Vercel**: `fieldservice/fieldservice-app` (org `team_B5mfkLEsv1WtATL1YxAx2Gsm`,
  projectId `prj_Pz7PBlDO8OLmOdBU1854XywQ176Z`), ligado localmente via
  `.vercel/project.json`.
- **Domínio de produção (alias estável)**: `https://fieldservice-app-nine.vercel.app`
  — é este o domínio "fixo" usado em todas as configurações (redirect URI
  do OAuth, webhooks, cron) — os deploys individuais geram URLs únicas
  (`https://fieldservice-XXXXX-fieldservice.vercel.app`) que mudam a cada
  `vercel --prod`, mas o alias mantém-se.
- **Último deploy confirmado**: commit `6b55b9c` (correção do middleware
  sw.js/manifest.json), verificado com `curl` a responder corretamente
  (`/sw.js` e `/manifest.json` → 200; rotas protegidas → 307; rotas de API
  com segredo errado → 401).
- **Vercel Cron ativo**: 1 job — `/api/integrations/google-sheets/process`,
  schedule `0 3 * * *` (diário, às 3h — é só a rede de segurança da
  sincronização do Sheets; a via principal é o `pg_net` imediato).
- **`pg_cron` ativo na BD** (fora do Vercel): job `tech-delay-check`,
  `* * * * *` (a cada minuto), `active: true` — confirmado nesta análise.
- **Variáveis de ambiente em produção** (nomes confirmados via `vercel env
  ls production`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SHEETS_SYNC_SECRET`, `CRON_SECRET`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
  `PUSH_CHECK_SECRET`. **Em falta**: `GOOGLE_SHEETS_CLIENT_ID`,
  `GOOGLE_SHEETS_CLIENT_SECRET`.
- **Build**: `npm run build` limpo (sem erros) na última verificação desta
  sessão.

---

## 14. Estado atual do Git/GitHub

- **Repositório**: `https://github.com/mikecqs/fieldservice-app` (branch
  única: `master`, sem outras branches remotas).
- **Working tree limpo** no momento desta análise (`git status` sem
  alterações pendentes) — tudo o que foi feito nesta sessão já está
  commitado e "pushado".
- **Commits mais recentes** (do mais antigo ao mais recente, todos já em
  `origin/master`):
  1. `93a6484` — Commit inicial: app FieldService (Next.js + Supabase)
  2. `829ffc7` — Acesso sequencial do técnico e validação administrativa de OS
  3. `a07127a` — Corrige bugs reportados na validação administrativa de OS
  4. `3719bee` — Corrige a área Admin para telemóvel
  5. `27f665c` — Auditoria e melhorias: pedidos, fecho de OS, agenda em
     calendário, histórico, financeiro, role FINANCE, catálogo+PDF, rebrand nexIA
  6. `4abe6fe` — Corrige botão Confirmar sem ação no fecho de OS (mobile)
  7. `e4377d9` — Melhorias funcionais: checklist por tipo, estado Preparado,
     secção Amanhã, reforço da Atenção, nº de orçamento, Equipamentos do cliente
  8. `c8c0019` — Auditoria de pendências: estado operacional automático dos
     pedidos, alerta de atraso, origem visível nas compras
  9. `3ca79cd` — Follow-up automático de orçamentos, cálculo de materiais+mão
     de obra no fecho da OS, redesign visual nexIA
  10. `de79dc5` — Recuperação de password, popup de agenda, métricas
      financeiras, exportação Excel
  11. `8decab0` — Corrige contraste: campos de formulário com texto branco
      sobre fundo branco
  12. `6306c79` — Integração Google Sheets: espelho de gestão em tempo real
      por empresa
  13. `f3b2177` — Correções: fluxo de pedidos, visibilidade do técnico,
      notificações push e página de Relatórios
  14. `6b55b9c` (HEAD) — Corrige middleware: sw.js e manifest.json eram
      bloqueados pelo portão de sessão
- **Sem PRs abertos, sem issues geridas via GitHub** — todo o
  desenvolvimento foi feito diretamente em `master`.
- **`.env.local` nunca foi commitado** (gitignored) — todas as credenciais/
  segredos gerados nesta sessão existem só localmente e no Vercel (env
  vars), nunca no histórico do Git.

---

## 15. Próximos passos que estavam previstos

Não há um roadmap formal documentado no repositório, mas com base no fluxo
desta conversa, os passos pendentes mais imediatos eram:

1. **Completar a configuração do Google Sheets**: o Admin precisa de criar
   a app OAuth no Google Cloud Console (projeto, ativar Sheets API,
   consent screen em modo "Testing" com o próprio email como test user,
   Client ID/Secret com redirect URI
   `https://fieldservice-app-nine.vercel.app/api/integrations/google-sheets/callback`)
   e fornecer as credenciais para configurar `GOOGLE_SHEETS_CLIENT_ID`/
   `GOOGLE_SHEETS_CLIENT_SECRET` no Vercel — só depois disso é possível
   testar o fluxo real "Ligar → autorizar → Sheet criado → sincronizado".
2. **Verificação visual manual** (dado que a ferramenta de browser não
   esteve disponível): confirmar visualmente o popup da agenda, os
   gráficos e exportação da página de Relatórios, e a responsividade
   mobile em dispositivos reais.
3. **Corrigir `app/page.tsx`** para reutilizar `homeForRole()` em vez da
   lógica própria incompleta (utilizadores FINANCE mal-encaminhados) —
   identificado nesta análise, ainda não corrigido.
4. **Considerar criar um `CLAUDE.md`** no repositório com as convenções e
   decisões de arquitetura (secção 10 deste documento é um bom ponto de
   partida), para uma sessão futura não depender de reconstruir este
   contexto a partir do código.
5. **Avaliar ligar o Vercel ao GitHub** para deploy automático no push,
   caso o fluxo manual atual (`git push` + `vercel --prod --yes`) não seja
   o desejado a prazo.
6. **Avaliar a atualização do Next.js** (vulnerabilidade crítica conhecida
   na versão atual) — decisão deliberadamente adiada por implicar uma
   mudança breaking não solicitada.

---

*Fim do resumo. Gerado por análise 100% read-only — nenhum ficheiro do
projeto, registo na base de dados, ou commit foi alterado para o produzir.*
