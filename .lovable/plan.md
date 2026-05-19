## Objetivo

1. Substituir a coluna **WhatsApp** em Cadastros → Alunos Ativos / Inativos pela coluna **Data Última Avaliação Funcional**.
2. Exibir essa mesma data, com destaque, no **Perfil do Aluno → Resumo** e em **Histórico de Avaliações**.
3. Atualizar a data automaticamente sempre que uma Avaliação Funcional for **agendada na Agenda** ou **concluída**.
4. **NOVO:** Criar automaticamente uma **tarefa para o professor responsável agendar nova avaliação** quando completarem **4 meses** desde a última avaliação funcional.

## Regra: "Última Avaliação Funcional"

A data é derivada (não armazenada) como o **maior valor** entre:
- `avaliacoes.data` com `tipo = 'funcional'` para o aluno
- `agenda_servicos.data_especifica` com `atividade ILIKE '%funcional%'` e `data_especifica <= hoje`

## Mudanças de UI

### `src/pages/StudentList.tsx`
- Remover coluna **WhatsApp** (header, célula, skeleton, `colSpan`).
- Adicionar coluna **"Última Aval. Funcional"** (visível em `lg:table-cell`).
- Estender a query `alunos_with_plans` para carregar em batch:
  - `avaliacoes` (aluno_id, data) tipo funcional dos IDs visíveis
  - `agenda_servicos` (aluno_id, data_especifica) `atividade ILIKE '%funcional%'` e `data_especifica <= hoje`
- Combinar em `lastFuncionalMap[aluno_id] = MAX(...)`.
- Cor: `text-warning` se >4 meses, `text-destructive` se >6 meses, `—` se nunca.

### `src/components/student/StudentSummary.tsx`
- Ampliar a query `last_aval_funcional` para considerar `avaliacoes + agenda_servicos`.
- Adicionar **card destacado** ("Última Avaliação Funcional") logo após a seção Plano, com badge de severidade (≤4m verde, 4–6m amarelo, >6m vermelho).

### `src/components/student/StudentAssessments.tsx`
- Adicionar **cabeçalho destaque** acima do botão "Realizar Avaliação":
  - "Última Avaliação Funcional: dd/MM/yyyy" (ou "Nunca realizada").

### Helper compartilhado `src/lib/avaliacaoFuncional.ts`
```ts
fetchLastFuncionalDate(alunoId): Date | null
fetchLastFuncionalDateBatch(alunoIds[]): Record<id, Date | null>
```

## NOVO: Tarefa automática "Agendar reavaliação funcional"

### Onde acontece
Uma **edge function agendada (cron diário)** + um **trigger pós-inserção** garantem cobertura.

### Trigger 1 — após nova avaliação funcional concluída
Função `fn_agendar_tarefa_reavaliacao_4m()` em `AFTER INSERT` em `avaliacoes` quando `tipo='funcional'`:

1. Calcular `data_limite = NEW.data + INTERVAL '4 months'`.
2. Resolver `responsavel_id`:
   - `alunos.responsavel_id`; se nulo ou ADM, usar `NEW.avaliador_id`; se ainda ADM, abortar (sem tarefa).
3. **Idempotência**: só inserir se NÃO existir `tarefas` com `aluno_id = NEW.aluno_id`, `tipo_auto = 'reavaliacao_funcional'`, `status = 'pendente'`.
4. Inserir em `tarefas`:
   - `titulo`: "Agendar reavaliação funcional"
   - `descricao`: "Última avaliação funcional realizada em <dd/mm/yyyy>. Agende uma nova avaliação."
   - `aluno_id`, `responsavel_id` (resolvido), `criado_por_id = NEW.avaliador_id`
   - `prioridade = 'media'`, `data_limite` (4 meses), `automatica = true`, `tipo_auto = 'reavaliacao_funcional'`.

### Trigger 2 — ao concluir pendência ou agenda funcional
Mesmo helper chamado também em `AFTER UPDATE` de `comissionamento_pendencias` quando `concluido` muda para `true` e `tipo_pendencia = 'concluir_avaliacao_funcional'`, para cobrir o caso de a avaliação ter sido feita apenas via Agenda.

### Job diário — varrer alunos sem reavaliação em 4 meses
Edge function `agendar-reavaliacoes-funcionais` (cron diário 07:00 BRT):
1. Para cada aluno `status='ativo'`:
   - Pegar `last_funcional` (mesma regra do helper).
   - Se `last_funcional IS NULL` **ou** `hoje >= last_funcional + 4 meses`:
     - Resolver `responsavel_id` (com fallback igual ao trigger).
     - Inserir tarefa idempotente (mesma checagem `tipo_auto = 'reavaliacao_funcional'` + `status = 'pendente'`).

> Garante que alunos antigos (sem trigger de avaliação recente) também recebam a tarefa, e que a tarefa seja recriada após ser concluída.

### Integração com alertas existentes
O `StudentSummary` e `AlertsWidget` já mostram "Agendar reavaliação funcional" no UI quando >4 meses — passa a ser também uma tarefa real em `tarefas`, visível em `TaskCenter` e `TasksWidget`.

## Backend changes resumo

1. Migração SQL:
   - `fn_resolver_responsavel_reavaliacao(aluno_id, fallback_user_id)` — utilitário.
   - `fn_agendar_tarefa_reavaliacao_4m()` — função do trigger.
   - Trigger `trg_avaliacao_reavaliacao_4m` em `avaliacoes`.
   - Trigger `trg_pendencia_reavaliacao_4m` em `comissionamento_pendencias`.
2. Edge function `supabase/functions/agendar-reavaliacoes-funcionais/index.ts`.
3. Cron job diário (07:00 BRT) via `pg_cron` + `pg_net` (insert direto via tool, não migration).

## Fora de escopo
- Não criar coluna nova em `alunos`. Data é sempre derivada.
- Não mexer nos triggers de comissionamento de Avaliação Funcional (já corrigidos).
- Não alterar `StudentHistory` (já lista cronologicamente).
