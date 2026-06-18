## Objetivo

Garantir que a coluna **Última Avaliação Funcional** em `/alunos` (e o card no perfil) seja atualizada imediatamente após qualquer mutação relevante, sem depender de hard refresh.

## Problema atual

Hoje a lista usa a query key `["last_funcional_batch", alunoIds]`, mas as mutações de avaliação invalidam apenas keys antigas (`["alunos_with_last_funcional"]`, `["last_funcional_aluno", id]`). Resultado: quando uma nova avaliação funcional é registrada, a célula continua mostrando `—` (ou data antiga) até hard refresh.

## Mudanças

### 1. Novo helper centralizado em `src/lib/query-invalidation.ts`

Adicionar key e função dedicadas:

```ts
queryKeys.lastFuncionalBatch = ["last_funcional_batch"] as const;
queryKeys.lastFuncionalAluno = (id: string) => ["last_funcional_aluno", id] as const;

export function invalidateAvaliacaoFuncional(qc, alunoId?) {
  qc.invalidateQueries({ queryKey: queryKeys.lastFuncionalBatch }); // prefix match cobre [..., alunoIds]
  qc.invalidateQueries({ queryKey: ["alunos_with_last_funcional"] }); // legado
  if (alunoId) qc.invalidateQueries({ queryKey: queryKeys.lastFuncionalAluno(alunoId) });
  qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
  qc.invalidateQueries({ queryKey: ["historico-timeline", alunoId] });
  qc.invalidateQueries({ queryKey: ["lembrete-avaliacoes-pendentes"] });
}
```

Por padrão, `invalidateQueries` faz match por prefixo, então invalidar `["last_funcional_batch"]` atinge a key real `["last_funcional_batch", alunoIds]` usada em `StudentList.tsx`.

### 2. Chamar `invalidateAvaliacaoFuncional` em todas as mutações que afetam avaliações funcionais

- `src/components/student/assessment/AssessmentForm.tsx` — insert (linha ~275) e update (linha ~127).
- `src/components/student/assessment/AssessmentViewerDialog.tsx` — delete (linha ~104).
- `src/components/student/StudentAssessments.tsx` — delete avaliação e insert de histórico manual (substitui a lista atual em `invalidates`).
- `src/pages/Agenda.tsx` — delete de `agenda_servicos` (a tabela também alimenta `fetchLastFuncionalDateBatch` quando o serviço é do tipo avaliação funcional). Mantém invalidações atuais e adiciona a nova.

Em cada chamada passamos `aluno_id` quando disponível para também invalidar a key por aluno usada no perfil.

### 3. Sem alterações em schema, RLS, UI ou na lógica de `fetchLastFuncionalDateBatch`

Apenas reuso das funções existentes e ajuste de invalidação.

## Validação

1. Build automático (sem erros TS).
2. Playwright headless: login → criar nova avaliação funcional em um aluno → voltar para `/alunos` sem hard refresh → confirmar que a data nova aparece na coluna com a cor de severidade correta.
3. Repetir o teste para exclusão (a data deve voltar para a avaliação anterior ou `—`).
