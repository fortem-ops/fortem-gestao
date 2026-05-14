# Fase 3 — Sincronização entre módulos + Padronização de erros

## Escopo

Garantir consistência entre módulos correlacionados (planos ↔ créditos, agenda ↔ consumo, pipeline ↔ alunos) e padronizar tratamento de erros no frontend. Sem mudanças visuais.

## 1. Sincronização no banco (1 migration)

Triggers e funções para manter dados coerentes automaticamente:

- **planos → creditos_aluno**: ao desativar/expirar um plano, marcar créditos de origem `plano` como `ativo=false`. Já existe parcialmente; revisar e completar.
- **agenda_servicos → consumo_servicos**: ao registrar consumo via agenda, validar que existe crédito disponível (já há lógica; padronizar via função `fn_consumir_credito` reutilizável).
- **alunos.current_pipeline_stage_id ↔ pipeline_movements**: trigger `AFTER INSERT` em `pipeline_movements` que atualiza `alunos.current_pipeline_stage_id` para `to_stage_id`. Garante que UI nunca mostre estágio desatualizado.
- **alunos.status**: trigger que recalcula status (`ativo` / `licenca` / `inativo`) com base em `aluno_licencas` ativas e `planos.data_fim`. Hoje isso é calculado no frontend (`getDisplayStatus`); manter no front mas sincronizar a coluna para queries server-side e relatórios.
- **Cache invalidation no frontend**: lista das query keys afetadas por mutações comuns (criar plano, mover pipeline, dar baixa em consumo) — centralizar em `src/lib/query-invalidation.ts` com helpers `invalidateAluno(id)`, `invalidatePipeline()`, `invalidateAgenda()`.

## 2. Sistema global de erros (frontend)

Concluir o que ficou parcial na Fase 1:

- `src/lib/errors.ts`: classes/utilitários para classificar erros do Supabase (PostgrestError) em categorias acionáveis: `auth_required`, `permission_denied` (RLS), `validation`, `not_found`, `conflict` (unique/FK), `network`, `unknown`. Tradução PT-BR amigável.
- `toastError` (já criado) passa a usar essa classificação automaticamente. Remove dezenas de `try/catch` espalhados que repetem mensagens genéricas.
- Logger central (`src/lib/logger.ts`): níveis `debug`/`info`/`warn`/`error`; em produção, opcional envio futuro a um serviço (deixa hook pronto, sem integrar).
- `ErrorBoundary` (já criado) ganha botão "Reportar problema" que copia stack + rota para a área de transferência.

## 3. Hooks de mutação padronizados

- `useSupabaseMutation` wrapper sobre `useMutation` que:
  - chama `toastError` com classificação automática,
  - executa invalidação declarativa via `invalidates: ['alunos', 'agenda']`,
  - retorna `isPending`, `error` tipado.
- Migrar 3-5 mutações críticas (criar/editar aluno, mover pipeline, registrar consumo) como referência. As demais migram incrementalmente conforme tocadas.

## 4. Validação

- Rodar `supabase--linter` pós-migration (esperado: zero novos warnings).
- Smoke test manual: mover card no pipeline → confirmar que `alunos.current_pipeline_stage_id` atualiza sem refetch manual; criar licença → status muda; expirar plano → créditos `plano` somem da listagem.

## Fora do escopo (Fase 4 sugerida)

- Realtime no pipeline e notificações
- Migração ampla de todas as mutações para o novo wrapper
- E2E (Playwright) — requer setup novo
- Refatoração arquitetural maior

## Detalhes técnicos

- Triggers serão `AFTER INSERT/UPDATE` com `SECURITY DEFINER` + `SET search_path = public`, seguindo o padrão da Fase 1.
- Recalculo de status: função `fn_calcular_status_aluno(_aluno_id uuid) returns text`, chamada por trigger em `aluno_licencas` e `planos`.
- Invalidation helpers usam `queryClient.invalidateQueries({ queryKey: [...] })` com prefixos consistentes.
- Sem mudança de UI/UX visível.

Aprove para eu começar pela migration de triggers, seguir com `errors.ts`/`logger.ts` e por fim o `useSupabaseMutation`.
