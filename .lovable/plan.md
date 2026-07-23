# Plano: Módulo de Treinos no Portal do Aluno

## 1. Estrutura atual do banco (confirmada)

As queries revelaram que o modelo de treinos é **centralizado em JSONB**, sem tabela normalizada de exercícios por treino.

### Tabelas existentes

| Tabela | Função |
|--------|--------|
| `treinos` | Treino do aluno. Colunas principais: `id`, `aluno_id`, `descricao`, `versao`, `status` (`atual`/`aguardando`/`arquivado`), `conteudo` (jsonb), `data_inicio`, `template_fase`, `autor_id`, `created_at` |
| `student_workout_progress` | Histórico de conclusão. Colunas: `id`, `aluno_id`, `treino_id`, `data`, `concluido_em` |
| `treino_slots` | Slots de agenda de treino. Colunas: `id`, `dia_semana`, `horario_inicio`, `horario_fim`, `capacidade_maxima`, `instrutor_id`, `ativo` |
| `treino_agendamentos` | Agendamentos de treino. Colunas: `id`, `aluno_id`, `slot_id`, `data`, `horario_inicio`, `horario_fim`, `status`, `credito_debitado`, `cancelado_em`, `observacoes` |
| `treino_horarios_fixos` | Horários fixos para alunos Power/Pro/Max |
| `banco_treinos_escolhas` | Escolhas de exercícios do banco de treinos |
| `banco_treinos_personalizados` | Templates personalizados do banco de treinos |
| `exercicio_categorias` | Taxonomia de categorias/subcategorias |
| `exercicios_personalizados` | Exercícios customizados do banco |

### Formato do JSONB em `treinos.conteudo`

A estrutura real (exemplo do treino da Bruna Meyer) segue este padrão:

```text
{
  "__personalizado": true,
  "aquecimento": [
    {
      "ordem": 1,
      "exercicio": "Fáscia plantar com bolinha",
      "categoria": "LIB",
      "subcategoria": "Pé/Tornozelo",
      "series": 1,
      "repeticoes": "60\"",
      "dias": ["T1", "T2", "T3", "T4"],
      "video_url": "https://..."
    }
  ],
  "treinos": [
    {
      "nome": "Treino A",
      "exercicios": [
        { ...mesmo shape... }
      ]
    }
  ],
  "estrutura": {
    "aquecimento": { "LIB": [...], "MOB": [...], "ATI": [...], "PREV": [...] },
    "treinos": { ... }
  }
}
```

Observações importantes:
- Não existe tabela `treino_exercicios`; os exercícios vivem dentro do JSONB.
- O campo `ativo` não existe mais em `treinos`; o status é controlado pela coluna `status` (`atual`, `aguardando`, `arquivado`).
- Exercícios podem ter `exercicio_id` nulo quando são livres/personalizados.
- A propriedade `dias` indica em quais dias da semana (T1-T4) o exercício deve aparecer.

## 2. Objetivo do módulo no portal

Criar uma experiência no `/portal/treinos` onde o aluno possa:

1. Visualizar o **treino atual** com aquecimento e blocos de exercícios.
2. Filtrar exercícios por **dia da semana** (T1, T2, T3, T4) quando o treino tiver dias definidos.
3. Ver vídeos demonstrativos dos exercícios em modal.
4. Marcar o treino como **concluído** (registrando em `student_workout_progress`).
5. Acompanhar o **histórico de treinos** e o **progresso semanal**.
6. Integrar com **agenda de treinos** e **horários fixos** já existentes.

## 3. Fases de implementação

### Fase 1 — Refatorar leitura do treino atual

- Reutilizar a função `flatFromTreino` já existente em `src/pages/portal/PortalWorkouts.tsx`.
- Garantir compatibilidade com o shape `__personalizado: true` e com o shape legado `WorkoutData`.
- Adicionar filtro por dia da semana (T1-T4) quando `dias` estiver presente nos exercícios.

### Fase 2 — Melhorar UI/UX do portal

- Aplicar o tema Carbon já existente no portal (`bg-[#141414]`, primária `#E73C3E`).
- Criar cards expansíveis por bloco (Aquecimento, Treino A, Treino B, etc.).
- Adicionar indicador de exercício concluído por série (opcional, local state).
- Exibir badge de "Treino de hoje" baseado no dia da semana/agendamento.

### Fase 3 — Integrar progresso e agenda

- Reutilizar a tabela `student_workout_progress` para marcação de concluído.
- Exibir contador semanal (`feitos / meta`) já implementado em `PortalWorkouts.tsx`.
- Integrar com `treino_agendamentos` para mostrar próximos agendamentos confirmados.
- Para alunos Power/Pro/Max, exibir horários fixos de `treino_horarios_fixos`.

### Fase 4 — Vídeos e detalhes do exercício

- Reutilizar o modal de exercício já existente (`ExerciseModal` em `PortalWorkouts.tsx`).
- Garantir que `getYouTubeEmbedUrl` suporte shorts e URLs normais.
- Exibir categoria, subcategoria, séries, repetições e carga quando disponível.

### Fase 5 — Histórico e troca de treino

- Listar treinos arquivados/aguardando (já feito parcialmente).
- Permitir visualização de treinos passados sem permitir edição.
- Sincronizar com a RPC `ativar_treinos_agendados` para promover treinos agendados.

## 4. Detalhes técnicos

### Queries principais

1. Buscar treino atual do aluno:
```sql
SELECT * FROM treinos
WHERE aluno_id = :aluno_id
  AND status = 'atual'
ORDER BY created_at DESC
LIMIT 1;
```

2. Buscar progresso da semana:
```sql
SELECT * FROM student_workout_progress
WHERE aluno_id = :aluno_id
  AND data >= :week_start
  AND data <= :week_end;
```

3. Buscar agendamentos futuros:
```sql
SELECT * FROM treino_agendamentos
WHERE aluno_id = :aluno_id
  AND data >= CURRENT_DATE
  AND status IN ('confirmado', 'realizado')
ORDER BY data, horario_inicio;
```

### Componentes a criar/alterar

- `src/pages/portal/PortalWorkouts.tsx` — página principal do módulo.
- `src/components/portal/WorkoutDayFilter.tsx` — filtro por dia T1-T4.
- `src/components/portal/WorkoutBlockCard.tsx` — card de bloco de exercícios.
- `src/components/portal/WorkoutExerciseItem.tsx` — item de exercício com vídeo.
- `src/components/portal/WorkoutWeeklyProgress.tsx` — progresso semanal.
- `src/components/portal/WorkoutScheduleCard.tsx` — próximos agendamentos.

### API/hooks

- Criar `src/hooks/usePortalWorkout.ts` para centralizar query do treino + progresso.
- Criar `src/hooks/useTreinoAgendamentos.ts` para próximos agendamentos.
- Reutilizar `usePushNotifications` para lembrete de treino (futuro).

### Riscos e considerações

- O JSONB pode ter shapes diferentes (`__personalizado` vs legado). Normalização futura pode ser necessária.
- Exercícios sem `exercicio_id` não linkam com o banco; vídeo e nome vêm do próprio JSON.
- O filtro por dia (`dias`) nem sempre estará presente; UI deve lidar com ausência.
- Marcação de conclusão deve respeitar duplicatas (constraint `duplicate` já tratada).

## 5. Próximos passos

Aguardar aprovação para iniciar a implementação na página `PortalWorkouts.tsx` e componentes auxiliares.