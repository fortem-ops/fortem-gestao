## Objetivo

Na **Central de Tarefas**, cada tarefa pendente passa a oferecer um botão **"Realizar"** que leva o usuário diretamente para o local onde a ação descrita é executada (em vez de apenas abrir o perfil do aluno na aba Resumo).

## Mapeamento de tipos de tarefa → destino

Identifiquei os `tipo_auto` existentes no banco e defini o destino de cada um:

| `tipo_auto` | Ação descrita | Destino ao clicar em "Realizar" |
|---|---|---|
| `gravar_video` | Gravar vídeo de execução | Já existe upload inline — mantém o botão atual |
| `atualizar_treino` | Atualizar treino do aluno | `/alunos/:id?tab=treinos` |
| `reavaliacao_funcional` | Reavaliar aluno | `/alunos/:id?tab=avaliacoes` |
| `pipeline_novo_lead` | Primeiro contato com lead | `/alunos/:id?tab=pipeline` |
| `pipeline_avaliacao_agendada` | Confirmar presença | `/alunos/:id?tab=pipeline` |
| `pipeline_proposta` | Follow-up da proposta | `/alunos/:id?tab=pipeline` |
| `pipeline_risco_evasao` | Contato de retenção | `/alunos/:id?tab=pipeline` |
| Tarefa manual com `aluno_id` | — | `/alunos/:id?tab=tarefas` |
| Tarefa manual sem `aluno_id` | — | Sem botão (não há destino) |

## Mudanças técnicas

1. **`src/pages/StudentProfile.tsx`** — tornar as Tabs controladas pela query string `?tab=<valor>` (usando `useSearchParams`). Default permanece `resumo`. Trocar a aba via clique também atualiza a URL.

2. **`src/pages/TaskCenter.tsx`** (componente `TaskList`):
   - Adicionar helper `getTaskActionTarget(task)` que devolve `{ to, label }` conforme tabela acima.
   - Adicionar botão **"Realizar"** (ícone `ArrowRight`, `size="sm"`, variant `default`) ao lado dos demais controles, visível apenas quando a tarefa não está concluída e há destino definido.
   - Tarefas do tipo `gravar_video` continuam exibindo o `RecordVideoUpload` (não recebem botão "Realizar").
   - Clicar na área de texto da tarefa passa a usar o mesmo destino (mantendo o atual fallback para o perfil do aluno).

3. **`src/components/dashboard/TasksWidget.tsx`** — aplicar o mesmo botão "Realizar" no widget do dashboard, para consistência.

## Fora de escopo

- Não altera a lógica do backend nem o engine de criação automática de tarefas.
- Não altera permissões/RLS.
- Não mexe em tarefas do portal do aluno.
