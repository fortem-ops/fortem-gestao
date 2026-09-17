# Central de Tarefas: subabas por tipo + baixa automática das tarefas de vídeo

## 1. Subabas dentro de Programadas e Atrasadas

Cada uma das duas abas atuais passa a ter uma segunda linha de abas, agrupando as tarefas por tipo. Cada subaba mostra seu próprio contador (verde em Programadas, vermelho em Atrasadas) e só aparece quando há tarefa naquele grupo.

Grupos:

| Subaba | O que entra |
|---|---|
| Todas | tudo do período selecionado |
| Vídeos | gravar vídeo do banco de exercícios — visível só para coordenação/administração |
| Treinos | troca/atualização de ficha de treino |
| Avaliações | reavaliação funcional, avaliação funcional agendada, relatório de treino experimental |
| Relatórios | relatório técnico de força e de corrida |
| Ponto | fechamento de ponto |
| Comercial | tarefas de pipeline (já restritas a administradores) |
| Outras | tarefas criadas manualmente e qualquer tipo novo |

A subaba "Todas" fica selecionada por padrão. Nada muda no visual dos cards, nas ações ("Realizar", "Reagendar", upload de vídeo) nem nas regras de quem vê o quê.

## 2. Tarefa de vídeo some quando o vídeo é atualizado

Hoje a tarefa só é removida quando o vídeo é enviado pelo botão dentro da própria tarefa. Se o vídeo for colocado por outro caminho (link do YouTube ou upload direto na tela do Banco de Treinos), a tarefa continua aparecendo. Hoje há 487 tarefas de vídeo abertas e 189 delas já têm vídeo cadastrado.

Correção no banco, valendo para qualquer caminho:

- Gatilho em `exercicios_personalizados`: sempre que o exercício passar a ter vídeo (link ou arquivo), as tarefas abertas de gravação daquele exercício são apagadas.
- Limpeza única das 189 tarefas já obsoletas.

## Detalhes técnicos

- `src/pages/TaskCenter.tsx`: função de classificação por `tipo_auto`/`origem` em grupos, `Tabs` aninhado dentro de cada `TabsContent`; grupo "Vídeos" condicionado a `roles.isCoordAdmin`. `TaskList` permanece intacto.
- Migration aditiva: `fn_exercicio_video_conclui_tarefa()` (`AFTER UPDATE OF video_url, video_path ON public.exercicios_personalizados`, `SECURITY DEFINER`, `search_path = public`) fazendo `DELETE FROM tarefas WHERE tipo_auto = 'gravar_video' AND descricao = 'exercicio_id:' || NEW.id`, mais o `DELETE` de backfill no mesmo arquivo. Sem alteração de RLS, de colunas ou de outras tarefas.
