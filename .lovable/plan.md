## Diagnóstico real

Rodei o scanner de segurança e o linter do banco. Resultado:

- **112 achados de segurança** (todos `warn`, nenhum `error` crítico). Distribuídos em ~5 categorias.
- **101 issues no linter do Postgres** (mesma origem dos achados de segurança).
- **Backend e auth saudáveis** — login retorna 200. Sintoma de "lentidão" não é causado por queries quebradas.
- **Frontend já tem lazy loading** em todas as rotas, `ProtectedRoute` já cacheia roles via react-query (5 min staleTime), `QueryClient` já desativa `refetchOnWindowFocus`. Ou seja, o básico de performance já existe.
- **51 tabelas** no schema `public`.

### Categorias dos 112 achados

1. **Function Search Path Mutable** (~30 funções) — funções sem `SET search_path = public` explícito. Risco: search_path hijacking.
2. **Public Can Execute SECURITY DEFINER Function** (~25 funções) — funções `SECURITY DEFINER` com EXECUTE concedido a `anon`. Devem ser restritas a `authenticated`.
3. **RLS Policy Always True** (algumas políticas de UPDATE/DELETE/INSERT com `USING (true)`).
4. **Public Bucket Allows Listing** — bucket de storage público permite listar arquivos.
5. **Outros** — duplicatas e variações dos itens acima.

### Causa real da lentidão de carregamento

Sem queries lentas detectadas no diagnóstico rápido. Hipóteses prováveis (a confirmar na Fase 2 de Performance):
- Dashboard fazendo várias queries em paralelo no mount.
- Falta de índices em `alunos(responsavel_id)`, `agenda_servicos(profissional_id, dia_semana)`, `tarefas(responsavel_id, status)`, `pipeline_movements(aluno_id, moved_at)`.
- Tamanho da instância Cloud pode estar sub-dimensionado para o volume atual.

---

## Plano da Fase 1 — Segurança + Estabilidade

### Passo 1 — Endurecer funções do banco (1 migration)

- Adicionar `SET search_path = public` em todas as funções que ainda não têm (~30).
- `REVOKE EXECUTE ... FROM anon` em todas as funções `SECURITY DEFINER` que não devem ser chamadas sem login (~25). Manter EXECUTE para `authenticated`.
- Funções públicas legítimas (ex.: `fn_clube_validar_token` chamado via QR) ficam acessíveis a `authenticated` apenas.

### Passo 2 — Corrigir políticas RLS permissivas (1 migration)

- Identificar políticas de UPDATE/DELETE/INSERT com `USING (true)` e substituir por checagens reais (`auth.uid() = ...` ou `is_coordinator_or_admin(auth.uid())`).
- Revisar tabelas sensíveis: `alunos`, `planos`, `vendas`, `creditos_aluno`, `user_roles`, `profiles`, `legal_annexes`.

### Passo 3 — Restringir bucket público de storage (1 migration)

- Remover SELECT público amplo em `storage.objects` para o bucket público; manter SELECT por path autorizado.

### Passo 4 — Estabilidade do frontend

- **Error Boundary global** em `src/main.tsx` envolvendo `<App/>`, com fallback amigável e botão "Recarregar".
- **GlobalLoader / GlobalErrorToast**: padronizar `useToast` com 2 helpers (`toastError`, `toastSuccess`) já normalizando "Failed to fetch" como mensagem de rede.
- **react-query**: adicionar `retry: 2` com backoff exponencial e `refetchOnReconnect: true` no `QueryClient`.
- **Rota 404 catch-all** já existe; garantir que o Suspense fallback não trave por mais de 6s (timeout de segurança visual).

### Passo 5 — Validação automática

- Rerodar o scanner de segurança após as migrations.
- Conferir que o número de findings cai para próximo de zero (resta apenas o que for intencional).
- Atualizar `security memory` documentando o que ficou intencionalmente público.

---

## Fora do escopo desta fase (irá para Fase 2 e 3)

- Índices de banco e otimização de queries.
- Refactor de hooks, debounce, paginação.
- Sincronização entre módulos via novos triggers.
- Testes E2E completos.

Vou apresentar essas fases depois que a Fase 1 estiver aprovada e validada — é a forma mais segura de evitar regressão e gasto desnecessário de créditos.

---

## Entregáveis desta fase

- 3 migrations SQL (search_path + revoke execute, RLS, storage).
- ErrorBoundary + helpers de toast + ajustes no `QueryClient`.
- Relatório final: nº de findings antes/depois, lista de funções endurecidas, políticas corrigidas.

Estimativa: execução em 1 ciclo de aprovação de migration + 1 rodada de edits de frontend.
