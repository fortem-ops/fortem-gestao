## Adicionar filtros em Cadastros > Alunos Ativos

### 1. `src/components/student/StudentListFilters.tsx`
Adicionar ao `StudentFilters`:
- `ultimaAvaliacaoFuncional: "todos" | "em_dia" | "pendente" | "atrasada"`
- `servicoPlanoDisponivel: "todos" | "avaliacao_funcional" | "nutricao" | "reabilitacao"` (significa: tem crédito do plano disponível — `total - usado > 0` — para o serviço selecionado)

Atualizar `defaultFilters`, contagem de filtros ativos (`activeCount`), e adicionar dois novos `<Select>` no grid de filtros avançados:
- **Última Avaliação Funcional**: Todas / Em dia / Pendente / Atrasada
- **Serviços do Plano Disponíveis (com crédito)**: Todos / Avaliação Funcional / Nutrição / Reabilitação

### 2. `src/pages/StudentList.tsx`
No `useMemo` de `filtered`, adicionar duas verificações:

- **matchAvalFunc**: usa `lastFuncionalMap[s.id]` + `severityForLastFuncional()` (já importados). Mapear `status-active`→`em_dia`, `status-warning`→`pendente`, `status-urgent`→`atrasada`.
- **matchServDisp**: para a atividade selecionada, achar a chave correspondente em `s.credits.plano` (`"Avaliação Funcional"`, `"Consultas Nutrição"`, `"Consultas Reabilitação"`) e validar que `ilimitado || total - usado > 0`.

Adicionar `lastFuncionalMap` às dependências do `useMemo`.

### Fora de escopo
Backend, RLS, edge functions, qualquer mudança nos cards/listagem.
