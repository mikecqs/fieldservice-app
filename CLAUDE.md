# CLAUDE.md — nexIA (fieldservice-app)

Contexto permanente para sessões futuras do Claude Code neste repositório.
Este ficheiro é um resumo funcional — para detalhe exaustivo do schema ver
`supabase/schema.sql` (fonte de verdade). `RESUMOTECNICOnexIA.md` é um
**documento histórico de uma sessão específica**, não uma fonte de verdade:
já foi confirmado que contém pelo menos uma afirmação falsa (ver secção 10)
— nunca assumir que algo lá descrito existe sem verificar contra o código.

## 1. Objetivo e natureza da aplicação

nexIA é uma aplicação SaaS **multi-tenant** (multi-empresa) de gestão de
serviços técnicos no terreno ("field service management"): pedidos de
cliente → orçamento → agendamento → execução por técnico → validação →
faturação. Cada empresa (tenant) só vê os seus próprios dados.

## 2. Stack e arquitetura

- **Next.js 14 (App Router)** — Server Components para leitura, Server
  Actions para escrita. Sem API REST/GraphQL separada (só rotas `/api/*`
  pontuais para OAuth/webhook/cron do Google Sheets).
- **TypeScript** (sem tipos gerados da BD — o cliente Supabase é usado de
  forma solta, `any` é comum e aceite neste projeto), **React 18**,
  **Tailwind CSS** (tema escuro nexIA).
- **Supabase (Postgres)** — `@supabase/ssr` + `@supabase/supabase-js`;
  autenticação via Supabase Auth; lógica de negócio crítica em funções SQL
  `SECURITY DEFINER` (RPCs).
- **pdf-lib** (PDF de orçamentos), **xlsx/SheetJS** (exportações Excel).
- **Deploy**: Vercel (serverless, sem servidor sempre ligado) + GitHub.
  Vercel **não** está ligado ao GitHub para deploy automático — deploy é
  manual (`git push` + `vercel --prod`).
- Sincronização assíncrona orientada a eventos (só Google Sheets — ver
  secção 10 sobre Web Push) via triggers Postgres + `pg_net`/`pg_cron`, não
  polling.
- **Regras de estado centralizadas em `lib/*-estado.ts`** (padrão
  consolidado nos BLOCOS 5–9): `lib/servico-estado.ts`,
  `lib/orcamento-estado.ts`, `lib/compra-estado.ts`, `lib/pedido-estado.ts`
  — cada um exporta funções puras (`podeX(...)`) que são a única fonte de
  verdade de uma regra de transição de estado, importadas tanto pelas
  Server Actions (validação real) como pelos componentes de UI (para
  refletir visualmente o mesmo critério, nunca uma segunda regra
  divergente).

## 3. Estrutura relevante do projeto

```
app/admin/*        área Admin: clientes, pedidos, orçamentos, servicos,
                    agenda, compras, materiais, catalogo, faturacao,
                    financeiro, relatorios, configuracoes, utilizadores
app/atendimento/*   área própria da role ATENDIMENTO — só pedidos
                    (list/novo/detalhe), layout e sidebar próprios,
                    NUNCA partilha layout nem rotas com /admin/*
app/financeiro/*    área da role FINANCE (leitura + faturação)
app/tecnico/*       área do Técnico (mobile-first)
app/super-admin/*   gestão de empresas/tenants (role SUPER_ADMIN)
app/api/*           OAuth/webhook/cron do Google Sheets
middleware.ts       gate leve de sessão (só verifica cookie existe)
components/pedidos/ PedidoModal, PedidoDetalheConteudo, NovoPedidoForm —
                    partilhados entre /admin/pedidos, /admin/clientes e
                    /atendimento/pedidos (ver secção 8.1/8.2)
lib/auth.ts         requireRole, getOrgId, getOrgIdAndRole, homeForRole
lib/financeiro.ts   motor central de estatísticas (getFinanceiroStats)
lib/servico-estado.ts    regras de transição de Serviço/OS
lib/orcamento-estado.ts  regras de transição de Orçamento
lib/compra-estado.ts     regras de transição de Compra
lib/pedido-estado.ts     regras de transição de Pedido + rótulo operacional
lib/operacional.ts       critérios partilhados Dashboard/Atenção/Agenda
                    (atraso, follow-up, "por agendar")
lib/agenda-dates.ts      utilitários de data/hora local (não misturar com
                    toISOString(), que é UTC — ver nota na secção 5)
lib/google-sheets/  OAuth + sync engine para a integração Sheets
supabase/schema.sql fonte de verdade do schema (RLS incluída)
```
Cada módulo Admin segue o mesmo padrão: `page.tsx` (Server Component,
`supabase.from(...).select(...)`) + `actions.ts` (Server Actions). Módulos
com regras de estado têm também o `lib/*-estado.ts` correspondente.

## 4. Roles e permissões

- **SUPER_ADMIN** — gere todas as empresas (`organizations`); cria empresas
  e o primeiro Admin de cada uma; é o único que pode criar utilizadores
  **ATENDIMENTO** (`app/super-admin/actions.ts`:
  `criarAtendimentoDaEmpresa`). Acesso total via RLS (`is_super_admin()`).
- **ADMIN** — gestão completa da própria empresa. Não pode criar nem
  promover ninguém (nem a si próprio) para `SUPER_ADMIN` nem `ATENDIMENTO`
  — a policy `"admin can manage profiles in own org"` só permite
  `role in ('ADMIN','TECHNICIAN','FINANCE')`. Continua com acesso direto
  total (RLS `for all`) às tabelas operacionais da própria empresa
  (`services`, `budgets`, `requests`, `purchases`, etc.) — decisão de
  confiança deliberada, ver secção 10.
- **TECHNICIAN** — acesso restrito às próprias OS, só via
  `services_technician_view`/`clients_technician_view`/
  `client_addresses_technician_view` e as RPCs `tech_start_service`/
  `tech_finish_visit`. Sem `UPDATE` direto em `services`, `visits`,
  `visit_materials_used` nem `visit_photos` — só `SELECT`/`INSERT` do
  próprio (ver secção 5).
- **FINANCE** — só leitura (`services`, `requests`, `budgets`, etc.) + as 3
  RPCs de faturação (`finance_validar_servico`, `finance_rejeitar_servico`,
  `finance_marcar_faturado`); sem gestão de utilizadores/configurações/
  operação técnica. Área própria em `/financeiro/*`.
- **ATENDIMENTO** — role de loja física, substitui os pedidos em papel
  (BLOCO 1). Só pode: criar clientes, criar moradas de cliente, criar
  pedidos, e consultar (SELECT) essas mesmas três tabelas na própria
  empresa — nunca `UPDATE`/`DELETE`, e sem policy nenhuma em
  `budgets`/`services`/`purchases`/faturação (RLS sem policy = tabela
  invisível para essa role). Vê um estado operacional resumido do pedido
  (ex: "Orçamento enviado", "Serviço agendado") através da view segura
  `requests_status_atendimento_view` — expõe só `estado`, nunca valor/IVA/
  faturação. Área própria em `/atendimento/*` (layout com
  `requireRole(["ATENDIMENTO"])`), **sem nenhum link nem rota partilhada
  com `/admin/*`** — confirmado que continua assim.

## 5. Segurança e multi-tenant

- **RLS é a fronteira de segurança real**, não a UI/middleware. Toda a
  tabela tem `organization_id` e policies `organization_id = my_org()` +
  `my_role() in (...)`. Isolamento entre empresas é garantido pela BD.
- **Multi-tenant**: nunca confiar em `organization_id` vindo do cliente —
  usar sempre `getOrgId()`/`getOrgIdAndRole()` no servidor; RLS rejeita
  mesmo que forjado.
- **`createAdminClient()` (service-role) ignora RLS por completo.** Usado
  em `app/admin/configuracoes/integracoes-actions.ts`,
  `app/admin/utilizadores/actions.ts` e `app/super-admin/actions.ts` (só
  para `auth.admin.createUser`, nunca para escrever `profiles` — essa
  escrita usa sempre o cliente normal, sujeito a RLS) e em todo
  `app/api/integrations/google-sheets/*` + `lib/google-sheets/*`. **Toda
  query feita com este cliente tem de filtrar `organization_id`
  explicitamente** — auditado por completo no BLOCO 10, sem problemas
  encontrados (todas as funções de `lib/google-sheets/rows.ts`/
  `process-queue.ts`/`stats.ts` já faziam isto corretamente).
- **RPCs `SECURITY DEFINER`** para tudo o que é crítico:
  `tech_start_service`, `tech_finish_visit`, `finance_validar_servico`,
  `finance_rejeitar_servico`, `finance_marcar_faturado`.
  `tech_finish_visit` (reforçado no BLOCO 5) só atua se a visita ainda
  estiver aberta (`hora_fim_real is null`) **e** o serviço estiver
  `em_curso` — impede executar a mesma visita duas vezes (retry de rede,
  duplo clique, ou chamada direta à RPC), o que antes podia duplicar
  materiais/fotos ou reabrir um serviço já validado/faturado.
- **Histórico é sempre aditivo — confirmado ao nível da RLS, não só da
  UI.** `service_events`, `service_validations` e `budget_events` só têm
  policies `SELECT`/`INSERT` (nenhuma `UPDATE`/`DELETE`, nem para
  ADMIN/SUPER_ADMIN). `service_validations` e `budget_events` tinham
  policies `for all` até ao BLOCO 5 — permitiam UPDATE/DELETE via RLS;
  corrigido.
- **`visits`, `visit_materials_used`, `visit_photos`**: ADMIN/SUPER_ADMIN
  têm acesso total (`for all`) dentro da própria empresa. O **Técnico só
  tem `SELECT` (das suas) e `INSERT` (na sua própria) — nunca `UPDATE` nem
  `DELETE`** em nenhuma das três tabelas. Fechar ou alterar uma visita
  passa sempre pela RPC `tech_finish_visit`. Esta correção (BLOCOS 5 e 9)
  fechou uma lacuna real: antes, o técnico conseguia editar/apagar
  materiais, fotos ou reabrir uma visita já fechada por fora da RPC.
- **Views seguras para técnico** (`services_technician_view` e afins) —
  nunca lê tabelas base diretamente; sem valores/margens/faturação.
- Colunas sensíveis podem ter `revoke select` (ex.: `refresh_token` do
  Google Sheets só é lido pelo `service_role`).
- **Datas/horas**: usar sempre `toISO()`/`addDays()`/`nowTimeHHMMSS()`/
  `startOfLocalDayUTC()` de `lib/agenda-dates.ts` para "hoje"/"agora" —
  nunca `new Date().toISOString()` sozinho (é UTC, desalinha perto da
  meia-noite local). Dashboard, Atenção e Agenda foram uniformizados no
  BLOCO 2; outros pontos do código (`app/tecnico/page.tsx`,
  `app/admin/orcamentos/actions.ts`, `lib/financeiro.ts`,
  `lib/google-sheets/stats.ts`) ainda usam `toISOString()` diretamente —
  não corrigido, fora do âmbito pedido até agora.

## 6. Fluxo principal

```
Cliente → Pedido (código PED-XXXXXX; morada obrigatória; tipo fixo:
          Agendamento/Orçamento/Manutenção/Instalação; origem fixa:
          Telefone/Loja/Email/Outro)
       ├─ "Orçamento"    → cria Orçamento diretamente
       ├─ "Agendamento"  → cria Serviço diretamente (nunca pergunta nada)
       └─ "Manutenção"/"Instalação" → pergunta "é necessário orçamento?"

Orçamento (rascunho → enviado → aguarda_resposta → followup →
           aceite/recusado/cancelado)
  - Itens/IVA só editáveis em 'rascunho'.
  - "Aceite" cria o Serviço (valor = calcularOrcamento(), com IVA) — nunca
    pode ser acionado duas vezes sobre o mesmo orçamento, nem sobre um já
    recusado/cancelado (guard server-side, BLOCO 6).
  - A morada do pedido de origem acompanha o Serviço criado.

Serviço/OS (por_agendar → agendado → em_curso → aguarda_validacao →
            concluido; ramos: nova_visita, nao_realizado, cancelado,
            correcao_necessaria)
  - Admin agenda (data/hora/técnico) via Agenda (popup) ou ficha do
    Serviço — mesma regra nos dois caminhos (`deveTransicionarParaAgendado`
    em lib/servico-estado.ts).
  - Serviços concluídos/cancelados/não-realizados ou já faturados NÃO
    podem ser reagendados nem ter técnico alterado — bloqueado no servidor
    e refletido na UI (`podeReagendarServico`).
  - Técnico inicia/fecha sempre via RPC (nunca UPDATE direto).
  - Cancelamento é uma ação explícita (`cancelarServico`, motivo
    obrigatório, evento `service_events` sempre registado) — não existe
    (removido no BLOCO 5) nenhum "forçar estado" genérico.
  - `nao_realizado` tem uma reativação explícita (`reativarServico`, ver
    secção 8.5) — nunca uma alteração de estado genérica.

Validação → Admin/Finance valida ou rejeita (RPCs finance_*); técnico
            nunca valida o próprio serviço.

Faturação → `finance_marcar_faturado` (por_faturar → faturado).
```
Todo o percurso é gravado em `service_events`/`budget_events`/
`service_validations` — histórico imutável, nunca apagado (ver secção 5).

## 7. Decisões de arquitetura a respeitar

1. RLS é a fronteira de segurança; UI é só conveniência.
2. `SECURITY DEFINER` + validação no servidor para qualquer regra crítica.
3. Histórico é sempre imutável e aditivo (sem UPDATE/DELETE em tabelas de
   eventos, nem para ADMIN/SUPER_ADMIN); eliminações de outras entidades
   marcam "Eliminado" em vez de apagar (Google Sheets).
4. Regras de transição de estado vivem sempre num `lib/*-estado.ts`
   partilhado (nunca duplicadas entre Server Action e UI, nem entre dois
   caminhos que levam ao mesmo sítio — ex: Agenda vs. ficha do Serviço).
5. Nunca um "forçar estado"/"avançar estado" genérico que aceite qualquer
   valor de destino sem validar a origem — cada transição tem de ser
   explícita e validada (ver secção 8 por módulo).
6. Sincronização orientada a eventos com fila resiliente (trigger → fila →
   `pg_net` best-effort → cron de recuperação), não polling síncrono.
7. `pg_cron` para tarefas frequentes (a cada minuto); Vercel Cron só para
   o que pode ser diário.
8. `lib/financeiro.ts` é a única fonte de verdade para estatísticas
   financeiras — reutilizado por Dashboard, Excel, Relatórios e Sheets.
9. Materiais "previsto" vs. "utilizado" nunca são fundidos — sempre
   distintos e visíveis separadamente.
10. Mobile do Técnico é prioridade máxima em qualquer decisão de UX.
11. Scope OAuth mínimo (Google Sheets: só `spreadsheets`, não `drive`).
12. IDs humanos (`CLI-XXXXXX`/`PED-XXXXXX`) são só para UI/pesquisa —
    nunca substituem o `uuid` interno em relações, queries ou URLs (ver
    secção 9).

## 8. Módulos implementados nesta sessão (BLOCOS 1–11)

### 8.1 Pedidos (BLOCOS 1, 3, 8)
- Lista (`app/admin/pedidos/page.tsx` + `PedidosLista.tsx`, client):
  pesquisa por código/cliente/tipo/origem/estado, agrupada por lógica
  operacional (exige ação → em andamento → concluído/arquivado no fim).
- Código humano `PED-XXXXXX` (`requests.codigo`, sequência dedicada).
- Detalhe: página completa (`/admin/pedidos/[id]`) **e** popup de consulta
  rápida (`PedidoModal`, em `components/pedidos/`, reutilizado também em
  Clientes) — ambos usam `obterDetalhePedido()` (única fonte da query,
  nunca duplicada) e mostram o percurso Pedido → Orçamento (se existir) →
  Serviço/OS (se existir), com o histórico de `budget_events`/
  `service_events` já existente, nunca um sistema de histórico novo.
  Secções sem dado mostram-no explicitamente ("Ainda não existe...").
- Novo Pedido (`NovoPedidoForm`, partilhado com `/atendimento/pedidos/novo`
  e com o fluxo "criar cliente → criar pedido"): cliente existente ou
  criado no próprio formulário (seleção automática); morada obrigatória,
  só do cliente selecionado (nunca mistura), criável no próprio fluxo;
  Tipo e Origem em dropdown fixo (ver secção 6).
- `arquivarPedido`, `converterEmOrcamento`, `decidirComOrcamento`,
  `decidirSemOrcamento` validam sempre `podeDecidirPedido()`
  (`estado === 'novo'`) no servidor antes de agir — evita criar um
  segundo orçamento/serviço órfão para o mesmo pedido (BLOCO 8).

### 8.2 Clientes (BLOCO 4)
- Código humano `CLI-XXXXXX` (`clients.codigo`), visível na lista, ficha e
  nos sítios onde o cliente é referenciado.
- Pesquisa simples (`ClientesLista.tsx`, client) por código/nome/empresa/
  telefone.
- Criação: Nome e Telefone obrigatórios (client + server-side em
  `criarCliente`). Depois de criado com sucesso, pergunta explicitamente
  **"Deseja criar um pedido?"** — Sim leva a `/admin/pedidos/novo?clientId=
  X` com o cliente já pré-selecionado (validado contra a lista real de
  clientes, nunca confiado cegamente no parâmetro); Não vai para a ficha
  do cliente.
- Ficha do cliente: "Serviços" é um popup (`ServicosPopup.tsx`, mesmo
  padrão visual do `PedidoModal`) — substituiu a antiga lista em texto
  corrido, que foi removida. "Pedidos" é uma lista compacta
  (`PedidosCompactos.tsx`) cujo código `PED-XXXXXX` abre o mesmo
  `PedidoModal` partilhado (nunca um segundo sistema de detalhe).
- Moradas e equipamentos: comportamento inalterado desde antes desta
  sessão (CRUD próprio em `app/admin/clientes/[id]/actions.ts`).

### 8.3 Serviços e Agenda (BLOCOS 5 e 9)
- Estados de `services`: `por_agendar`, `agendado`, `em_curso`,
  `aguarda_validacao`, `concluido`, `nova_visita`, `nao_realizado`,
  `cancelado`, `correcao_necessaria` (ver `app/admin/servicos/estados.ts`
  para os rótulos).
- `podeReagendarServico()` (`lib/servico-estado.ts`) bloqueia alterar
  data/hora/técnico quando `estado` é `concluido`/`cancelado`/
  `nao_realizado` ou `faturacao_estado === 'faturado'` — validado em
  `atualizarAgendamento` (ficha do Serviço), `criarOuAgendarNoPopup`
  (Agenda), `atribuirTecnico` e `removerTecnico`. Na UI, `AgendamentoForm`
  e o `ServicoModal` da Agenda mostram um estado bloqueado/só-leitura em
  vez do formulário editável, em vez de simplesmente escondê-lo.
- `deveTransicionarParaAgendado()` unifica a regra "`por_agendar`/
  `nova_visita` + data/hora válida → `agendado`" nos dois caminhos de
  agendamento (antes divergiam entre si).
- **"Forçar estado manualmente" foi removido** — não existe nenhum
  mecanismo genérico de mudança de estado.
- `cancelarServico` (ação explícita): motivo obrigatório, valida
  `podeCancelarServico()` (nunca se já `concluido`/`cancelado` ou já
  faturado), regista sempre um evento `service_events` (`tipo:
  'cancelado'`).
- Reativação de `nao_realizado` — ver secção 8.5.

### 8.4 Orçamentos (BLOCO 6)
- Estados: `rascunho`, `enviado`, `aguarda_resposta`, `followup`,
  `aceite`, `recusado`, `cancelado` (`ESTADOS_ORCAMENTO_TERMINAIS` =
  `aceite`/`recusado`/`cancelado`).
- `adicionarItem`/`removerItem`/`atualizarIva` só permitidos com
  `estado === 'rascunho'` (`podeEditarItensOrcamento`) — validado no
  servidor, não só escondido na UI.
- `marcarEnviado` só a partir de `rascunho` (`podeMarcarEnviado`).
- `avancarEstado` valida `podeAvancarParaEstado()` — cada estado de
  destino só é alcançável a partir dos estados de origem que a UI já
  oferecia (nunca aceita um valor de estado arbitrário do formulário).
- `aceitarOrcamento` valida `podeAceitarOrcamento()` — nunca cria um
  segundo serviço para o mesmo orçamento, nem aceita um já
  recusado/cancelado. Bug de UI corrigido: o botão "Aceite" já não fica
  visível num orçamento `recusado` (a condição esquecia esse estado).

### 8.5 Reativação de serviço `nao_realizado` (bloco dedicado)
- Único caminho legítimo de saída de `nao_realizado` — não é uma
  alteração de estado genérica.
- Ação explícita `reativarServico` (`app/admin/servicos/actions.ts`):
  restrita a ADMIN/SUPER_ADMIN (verificado com `getOrgIdAndRole`); só
  atua se `estado` for exatamente `nao_realizado`
  (`podeReativarServico()`); nunca se `faturacao_estado === 'faturado'`;
  exige sempre nova data e hora; técnico é opcional (mesma regra do resto
  do fluxo de agendamento); reutiliza `verificarConflitoAgenda` (mesmo
  aviso não-bloqueante da Agenda) antes de gravar. Novo estado sempre
  `agendado`. Regista sempre um evento `service_events` com `tipo:
  'reativado'` (valor acrescentado ao `CHECK` da coluna, aditivo).
- UI: secção "Reativar serviço" na ficha do Serviço, só visível quando
  `podeReativarServico(servico)` é verdadeiro.
- Depois de reativado, aparece na Agenda como qualquer serviço
  `agendado` normal — sem fluxo paralelo.

### 8.6 Compras (BLOCO 7)
- Estados usados: `por_encomendar`, `encomendada`, `recebida` — são os
  únicos com caminho de entrada na UI hoje.
- `avancarEstadoCompra` valida `podeAvancarCompraParaEstado()` — só
  permite exatamente `por_encomendar → encomendada` e
  `encomendada`/`parcial → recebida`.
- **`parcial` e `cancelada` existem no `CHECK` da coluna mas não têm
  nenhuma ação/UI dedicada** — decisão de produto ainda por tomar, não
  implementada (ver secção 10). Não inventar esse fluxo sem pedido
  explícito.

### 8.7 Dashboard (BLOCO 2)
- Reorganizado por prioridade operacional: Ação necessária → o que está a
  acontecer hoje (agenda + estado dos técnicos) → progresso do dia →
  indicadores gerais (inclui os financeiros, via `getFinanceiroStats`).
  Reutiliza os mesmos critérios de atraso/follow-up/"por agendar" de
  `lib/operacional.ts`, partilhados com a Central de Atenção.

## 9. Códigos humanos

- **Clientes** → `CLI-000001`, `CLI-000002`, ... (`clients.codigo`).
- **Pedidos** → `PED-000001`, `PED-000002`, ... (`requests.codigo`).
- Gerados por sequência Postgres dedicada (`clients_codigo_seq`/
  `requests_codigo_seq`), atómica e sem colisão mesmo com inserts
  simultâneos; nunca reutilizados; nunca alterados depois de criados.
- São **só para UI, pesquisa e comunicação com o cliente/operação** — o
  `uuid` (`id`) continua a ser a única chave usada em relações, queries e
  URLs.
- **Serviços/OS não têm código humano** — não existe no schema. Não
  inventar um (ex: "OS-XXXXX") só para consistência visual; se for
  pedido, é uma alteração de schema a decidir separadamente.

## 10. Problemas conhecidos / decisões pendentes

- **Web Push / notificações de atraso não estão implementadas no código
  deste repositório.** Referências a essa funcionalidade em
  `RESUMOTECNICOnexIA.md` (VAPID, Service Worker, tabelas
  `push_subscriptions`/`tech_delay_notifications`, rota
  `api/push/check-delays`, job `pg_cron` "tech-delay-check") são
  históricas/incorretas — confirmado por auditoria exaustiva (grep a todo
  o repositório + `git log --all`) que nada disto existe nem alguma vez
  existiu; o pacote `web-push` nem está no `package.json`. Não implementar
  isto sem um pedido explícito e aprovado.
- **ADMIN mantém acesso direto total (RLS `for all`) a `services`,
  `budgets`, `requests`, `purchases`**, incluindo colunas de faturação —
  decisão de confiança deliberada (ADMIN é um papel de confiança nesta
  app), permite em teoria contornar as RPCs `finance_*`/os guards das
  Server Actions via uma chamada direta à BD. Identificado nos BLOCOS 5/6,
  deliberadamente não alterado — só o FINANCE está funilado
  exclusivamente pelas RPCs. Rever numa futura fase de hardening, se
  decidido.
- **Compras**: `parcial` e `cancelada` sem fluxo/UI dedicados (ver 8.6) —
  lacuna registada, não implementada, à espera de decisão de produto.
- **Google Sheets** não testado ponta-a-ponta em produção — falta
  `GOOGLE_SHEETS_CLIENT_ID`/`SECRET` no Vercel.
- **Materiais previsto vs. utilizado** casados por nome de texto (sem FK)
  — falha silenciosa se os nomes não baterem.
- **"Horas disponíveis" nos Relatórios** é uma estimativa (nº técnicos ×
  dias × 8h), sem configuração real de capacidade/turnos.
- **Datas/horas em UTC fora de Dashboard/Atenção/Agenda** — ver nota no
  fim da secção 5 (não uniformizado em todo o código, só nesses três
  módulos).
- Sem testes automatizados (unit/integration/e2e) no repositório.
- Sem CI/CD; Vercel não ligado ao GitHub para deploy automático.
- Vulnerabilidades de dependências conhecidas por corrigir (`next@14.2.15`
  crítica, `postcss`, `xlsx`) — atualização do Next.js adiada por ser
  breaking change fora do âmbito pedido até agora.
- Verificação visual/browser não confirmada em várias sessões recentes
  (ambiente instável) — validar cliques reais antes de dar por fechado.

## 11. Regras de trabalho para alterações futuras

- **Nunca enfraquecer RLS ou isolamento multi-tenant** — toda a query/RPC
  nova deve respeitar `organization_id = my_org()`; se usar
  `createAdminClient()`, filtrar `organization_id` manualmente sempre.
- **Nunca tornar histórico mutável** — `service_events`, `budget_events`,
  `service_validations` são sempre append-only (só `SELECT`/`INSERT`).
- **Nunca dar ao técnico acesso de escrita direto** a tabelas
  administrativas nem a `visits`/`visit_materials_used`/`visit_photos` —
  só via RPCs específicas e validadas.
- **Nunca introduzir um "forçar estado"/"avançar estado" genérico** — cada
  transição é uma ação explícita, validada no servidor contra um
  `lib/*-estado.ts` partilhado com a UI.
- **Não alterar comportamento existente sem antes verificar o impacto**
  (grep por usos, ler o módulo equivalente já implementado como padrão).
- **Testar antes de concluir** — pelo menos ao nível de dados/RPC/SSR;
  sempre `npx tsc --noEmit` + `npm run build`; se a verificação visual em
  browser não for possível, dizer isso explicitamente em vez de assumir
  que passou.
- **Não confiar em valores vindos do cliente** para dinheiro ou transições
  de estado — validar sempre no servidor/RPC.
- **Não inventar funcionalidades, códigos humanos ou fluxos de negócio**
  que não existam no schema/código — se uma lacuna for identificada,
  documentá-la como pendente (secção 10) em vez de a resolver sem
  aprovação.
- Ao adicionar um módulo novo, seguir o padrão existente (`page.tsx`
  Server Component + `actions.ts` Server Actions, `lib/*-estado.ts` se
  houver estado), não inventar um novo.
