## Módulo PONTO — registro de jornada para professores

Sistema de batida de ponto para professores, com dashboard em tempo real para coordenadores, ajustes auditados e fechamento mensal aprovado.

## Escopo desta entrega (MVP + Geolocalização)

Inclui: botão inteligente, jornada/intervalo, geolocalização opcional ao bater, dashboard coordenador, ajustes manuais com log, fechamento mensal via cron + aprovação, configuração por usuário com fallback global, relatórios básicos.

Fora deste escopo: IA de sugestão automática de correção, cruzamento com Agenda, score de consistência, integração financeira/folha. Ficam para fase 2.

## 1. Banco de dados

### Enums
- `ponto_evento_tipo`: `entrada | intervalo_inicio | intervalo_fim | saida`
- `ponto_jornada_status`: `em_andamento | em_intervalo | encerrada | bloqueada`
- `ponto_origem`: `web | mobile | ajuste_manual`
- `ponto_fechamento_status`: `aberto | em_revisao | aprovado`

### Tabelas

**`ponto_eventos`** (registros brutos imutáveis)
- `id`, `usuario_id` (uuid → auth.users), `jornada_id` (uuid → ponto_jornadas, nullable até consolidar), `tipo` (enum), `data_hora` (timestamptz default now()), `origem` (enum), `latitude` numeric, `longitude` numeric, `dispositivo` text (user-agent resumido), `observacao` text, `created_at`.
- Índices: `(usuario_id, data_hora desc)`, `(jornada_id)`.

**`ponto_jornadas`** (consolidação por dia/usuário)
- `id`, `usuario_id`, `data` (date), `entrada` timestamptz, `intervalo_inicio` timestamptz, `intervalo_fim` timestamptz, `saida` timestamptz, `minutos_trabalhados` int generated, `minutos_intervalo` int generated, `status` enum, `observacao` text, `fechamento_id` uuid (nullable), `created_at`, `updated_at`.
- UNIQUE `(usuario_id, data)`.

**`ponto_configuracoes`** (por usuário, com fallback global)
- `id`, `usuario_id` uuid nullable (NULL = configuração global padrão), `carga_diaria_min` int default 480, `intervalo_minimo_min` int default 30, `intervalo_obrigatorio` bool default false, `tolerancia_min` int default 10, `created_at`, `updated_at`.
- UNIQUE parcial: um único registro com `usuario_id IS NULL` (global).

**`ponto_fechamentos_mensais`**
- `id`, `usuario_id`, `mes` date (sempre dia 1), `total_minutos` int, `minutos_extras` int, `minutos_faltantes` int, `pendencias_count` int, `status` enum default `aberto`, `aprovado_por` uuid, `aprovado_em` timestamptz, `observacao` text, `created_at`, `updated_at`.
- UNIQUE `(usuario_id, mes)`.

**`ponto_ajustes_log`** (auditoria de qualquer alteração feita por coordenador)
- `id`, `jornada_id`, `usuario_alvo_id`, `responsavel_id` (quem ajustou), `campo` text, `valor_antes` text, `valor_depois` text, `motivo` text NOT NULL, `created_at`.

### Funções (SECURITY DEFINER, search_path=public)

- **`fn_ponto_estado_atual(_user_id uuid)`** → jsonb com `{status, jornada_id, ultimo_evento, proxima_acao}` (calcula qual botão mostrar).
- **`fn_ponto_registrar(_tipo, _lat, _lng, _observacao, _dispositivo)`** → valida transição válida (não pode `entrada` se já em jornada; não pode `saida` sem entrada; etc), insere em `ponto_eventos`, faz upsert em `ponto_jornadas` do dia, retorna jsonb com novo estado.
- **`fn_ponto_dashboard_coordenador(_data date, _professor_ids uuid[])`** → retorna jsonb com lista de professores + status do dia + horas + flags de inconsistência.
- **`fn_ponto_ajustar_jornada(_jornada_id, _campo, _novo_valor, _motivo)`** → valida que jornada não está em fechamento aprovado, escreve em `ponto_ajustes_log`, atualiza jornada. Apenas coord/admin.
- **`fn_ponto_calcular_fechamento(_user_id, _mes date)`** → consolida horas, extras, déficit, pendências (jornadas sem saída, intervalo ausente quando obrigatório). Idempotente, faz upsert em `ponto_fechamentos_mensais`.
- **`fn_ponto_aprovar_fechamento(_fechamento_id)`** → marca status `aprovado`, vincula `fechamento_id` em todas as jornadas do mês, bloqueia edição via trigger. Apenas coord/admin.
- **`fn_ponto_gerar_fechamentos_mes(_mes date)`** → cria/atualiza fechamentos para todos os professores do mês indicado e cria tarefa "Fechamento de Ponto - <mês>" para cada coordenador.

### Triggers
- `update_updated_at_column` em jornadas, configurações, fechamentos.
- `trg_ponto_bloquear_edicao_apos_aprovado` em `ponto_jornadas` BEFORE UPDATE: se a jornada tem `fechamento_id` e o fechamento está `aprovado`, rejeita.

### RLS

- **`ponto_eventos`**: SELECT próprio OR coord/admin. INSERT próprio (só via `fn_ponto_registrar`). Sem UPDATE/DELETE.
- **`ponto_jornadas`**: SELECT próprio OR coord/admin. UPDATE só coord/admin via função de ajuste. Sem DELETE.
- **`ponto_configuracoes`**: SELECT autenticado (lê própria + global). INSERT/UPDATE/DELETE só admin.
- **`ponto_fechamentos_mensais`**: SELECT próprio OR coord/admin. UPDATE só coord/admin. Sem DELETE.
- **`ponto_ajustes_log`**: SELECT próprio (alvo) OR coord/admin. INSERT só via função.

### Cron (job pg_cron, dia 1 de cada mês às 02:00)
Chama `fn_ponto_gerar_fechamentos_mes(date_trunc('month', now() - interval '1 day'))`. Cria automaticamente uma tarefa em `tarefas` para cada coordenador com título "Fechamento de Ponto — <Mês/Ano>" e prioridade alta.

## 2. Frontend

### Rotas novas (`src/App.tsx`)
- `/ponto` — tela do professor (botão inteligente + resumo do dia + histórico).
- `/ponto/equipe` — dashboard coordenador (tempo real).
- `/ponto/fechamento` — tela de fechamento mensal (coordenador).
- `/admin/ponto` — configurações globais e por usuário (admin).

### Sidebar (`src/components/AppSidebar.tsx`)
- Adicionar "Ponto" (ícone `Clock`) no grupo Principal — visível a todos.
- Adicionar "Equipe (Ponto)" e "Fechamento" no grupo Principal apenas para coord/admin (filtro client-side via `is_coordinator_or_admin`).
- Adicionar "Admin Ponto" no grupo Sistema.

### Componentes (`src/components/ponto/`)

- **`BotaoInteligente.tsx`** — consome `fn_ponto_estado_atual`, mostra um único botão grande contextual (Iniciar jornada / Iniciar intervalo / Finalizar intervalo / Encerrar jornada). Pede `navigator.geolocation.getCurrentPosition` no clique (com fallback silencioso se negado). Confirma via dialog quando encerra jornada.
- **`StatusJornadaCard.tsx`** — bloco superior com status visual ("🟢 Em jornada desde 06:32"), tempo decorrido em tempo real (tick a cada 30s).
- **`ResumoDoDia.tsx`** — entrada / intervalo / saída / horas hoje + campo "Adicionar observação" (atualiza última jornada).
- **`HistoricoJornadas.tsx`** — lista paginada das últimas 14 jornadas do professor com horas e status.
- **`EquipeAoVivoTable.tsx`** — tabela do dashboard coordenador com filtros (data, professor), badges de status, botão "Ajustar".
- **`AjustarJornadaDialog.tsx`** — coord/admin edita entrada/intervalo/saída com motivo obrigatório; grava em `ponto_ajustes_log`.
- **`FechamentoMensalTable.tsx`** — lista por professor com horas, extras, déficit, pendências; botão "Revisar" abre detalhe; botão "Aprovar fechamento" (com confirmação dura: "após aprovar não será possível editar").
- **`AdminPontoConfig.tsx`** — form para configuração global + tabela de overrides por usuário.

### Páginas

- **`src/pages/Ponto.tsx`** — tela do professor. Layout simples: status grande no topo, botão inteligente, resumo do dia, histórico abaixo.
- **`src/pages/PontoEquipe.tsx`** — dashboard coord com cards-resumo (ativos / não iniciaram / inconsistência) e a tabela ao vivo. Realtime via Supabase channel em `ponto_eventos`.
- **`src/pages/PontoFechamento.tsx`** — seletor de mês + tabela de fechamento + ação aprovar.
- **`src/pages/AdminPonto.tsx`** — configurações.

### Integrações com telas existentes
- **`Dashboard.tsx`**: novo widget `PontoWidget` (lateral direita, abaixo de `ClubeWidget`) — para professor mostra "Você está em jornada há 3h12" + atalho; para coord mostra "X em jornada · Y pendentes".

### Permissões UI
- Professor: vê apenas próprio `/ponto` e widget. Tentar acessar `/ponto/equipe` redireciona.
- Coord: tudo + `/ponto/equipe` e `/ponto/fechamento`.
- Admin: tudo + `/admin/ponto`.

### Realtime
Habilitar `ALTER PUBLICATION supabase_realtime ADD TABLE public.ponto_eventos, public.ponto_jornadas;` e usar canal único na tela `/ponto/equipe` para refresh automático.

### Detalhes técnicos relevantes

- Cálculo de horas: `minutos_trabalhados = (saida - entrada) - (intervalo_fim - intervalo_inicio)`, em minutos, via `GENERATED ALWAYS AS … STORED` (com `extract(epoch …)/60`).
- Geolocalização: chamada client-side com timeout 5s; se falhar, registra evento sem coordenadas. Não bloqueia.
- Dispositivo: enviado pelo client como `navigator.userAgent.slice(0,200)`.
- Pendências detectadas por `fn_ponto_calcular_fechamento`: jornadas sem `saida`, intervalo ausente quando `intervalo_obrigatorio=true`, intervalo abaixo do `intervalo_minimo_min`.
- Bloqueio pós-aprovação: enforced no banco via trigger; UI esconde botões de ajuste quando `fechamento_id IS NOT NULL` e fechamento aprovado.

## Arquivos tocados

**Migration única**: enums, 5 tabelas, índices, funções, triggers, RLS, cron job, realtime publication, semente da configuração global default.

**Novos**:
- `src/pages/Ponto.tsx`, `src/pages/PontoEquipe.tsx`, `src/pages/PontoFechamento.tsx`, `src/pages/AdminPonto.tsx`
- `src/components/ponto/BotaoInteligente.tsx`, `StatusJornadaCard.tsx`, `ResumoDoDia.tsx`, `HistoricoJornadas.tsx`, `EquipeAoVivoTable.tsx`, `AjustarJornadaDialog.tsx`, `FechamentoMensalTable.tsx`, `AdminPontoConfig.tsx`
- `src/components/dashboard/PontoWidget.tsx`
- `src/lib/ponto.ts` (helpers de formatação de duração, mapeamento de status → label/cor)

**Editados**:
- `src/App.tsx` (4 rotas novas, lazy-loaded)
- `src/components/AppSidebar.tsx` (3 itens novos com gating por role)
- `src/pages/Dashboard.tsx` (insere `PontoWidget`)
