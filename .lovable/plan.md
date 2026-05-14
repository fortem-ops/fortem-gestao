# Fase 2 — Performance + Banco de Dados

## Escopo

Otimizar consultas, reduzir renders e melhorar tempo de carregamento das páginas. Foco em ganho real mensurável, sem alterar funcionalidades.

## 1. Índices no banco (1 migration)

Criar índices nas colunas mais consultadas (filtros e joins frequentes):

- `alunos (responsavel_id)`, `alunos (status)`, `alunos (current_pipeline_stage_id)`
- `agenda_servicos (profissional_id, dia_semana)`, `agenda_servicos (aluno_id)`, `agenda_servicos (data_especifica)`
- `avaliacoes (aluno_id, data DESC)`, `avaliacoes (avaliador_id)`
- `pipeline_movements (aluno_id, moved_at DESC)`, `pipeline_movements (to_stage_id)`
- `notificacoes (criado_por, created_at DESC)`, `notificacao_destinatarios (usuario_id, status)`
- `creditos_aluno (aluno_id, ativo)`, `creditos_movimentos (credito_id, data DESC)`
- `consumo_servicos (aluno_id, data_consumo DESC)`, `consumo_servicos (plano_id)`
- `planos (aluno_id, ativo)`, `historico_profissional (aluno_id, created_at DESC)`
- `audit_log (user_id, created_at DESC)`

Todos `IF NOT EXISTS` para serem idempotentes.

## 2. Queries no frontend

- Substituir `SELECT *` por colunas explícitas nas listagens pesadas (Alunos, Agenda, Pipeline, Notificações, Dashboard).
- Adicionar paginação (range) nas listas que hoje carregam tudo: lista de alunos, histórico, notificações, audit.
- Padronizar `staleTime` por domínio no react-query (catálogos: 30min; listas: 2min; dashboards: 1min).
- Eliminar chamadas duplicadas detectadas (mesma query disparada em múltiplos componentes irmãos) — centralizar em hook único.

## 3. Renders e hooks no frontend

- Auditar `useEffect` com dependências instáveis nas páginas Dashboard, Alunos, Agenda, Pipeline.
- `React.memo` + `useCallback`/`useMemo` em linhas de listas grandes (AlunoRow, AgendaCard, PipelineCard).
- Debounce (300ms) em todos os campos de busca (Alunos, Pipeline, Notificações).

## 4. Code splitting adicional

- Verificar bundle e quebrar rotas grandes ainda não lazy (relatórios, banco de treinos, clube fortem).
- Pré-carregar (`prefetch`) rotas mais usadas a partir do menu lateral.

## 5. Validação

- Rodar Supabase linter pós-migration.
- Medir tempo de carregamento (Network panel) antes/depois nas 3 páginas mais lentas.
- Conferir se testes manuais de login/CRUD seguem ok.

## Fora do escopo (vai para Fase 3)

- Triggers de sincronização entre módulos
- Sistema global de erros padronizados (parcialmente feito na Fase 1)
- Refatoração arquitetural maior
- E2E tests

## Detalhes técnicos

- Índices: `CREATE INDEX CONCURRENTLY` não funciona dentro de migration transacional do Supabase, então usaremos `CREATE INDEX IF NOT EXISTS` simples (tabelas ainda pequenas, lock é aceitável).
- Paginação: `useInfiniteQuery` para listas grandes, `range(from, to)` no Supabase client.
- Hook centralizado: `useAlunos`, `useAgenda`, `usePipeline` se ainda não existirem unificados.

Aprove para eu começar pela migration de índices e seguir com as otimizações de frontend em ordem de impacto.
