# Carteira de Alunos — 3 colunas de acompanhamento

Adicionar a cada aluno da Carteira três indicadores coloridos com ação: **Avaliação Funcional**, **Troca de Ficha** e **Relatório**.

## Regras de status

**Avaliação Funcional** (mesma regra de Cadastros > Alunos Ativos, pela data da última avaliação funcional — considerando avaliações registradas e agendamentos já realizados):
- Verde: menos de 4 meses
- Amarelo: 4 a 6 meses
- Vermelho: 6 meses ou mais, ou nunca realizada

**Troca de Ficha** (tarefa automática de atualização de treino do aluno):
- Verde: sem tarefa aberta, ou tarefa aberta ainda dentro do prazo
- Vermelho: tarefa aberta com prazo vencido

**Relatório** (tarefas de relatório técnico de força e de corrida):
- Verde: sem tarefa aberta, ou dentro do prazo
- Vermelho: tarefa aberta vencida

Quando houver mais de uma tarefa do mesmo grupo, vale a mais crítica.

## Ações

Clicar no indicador abre um menu curto, com as mesmas destinações da Central de Tarefas:

- Avaliação Funcional: "Agendar/registrar avaliação" (ficha do aluno, aba Avaliações)
- Troca de Ficha: "Completar troca de ficha" (ficha do aluno, aba Treinos) e "Reagendar" (novo prazo para a tarefa)
- Relatório: "Completar relatório" (ficha do aluno, aba Registros > Relatórios) e "Reagendar"

O menu só mostra "Reagendar" quando existe tarefa aberta. Reagendar abre o mesmo seletor de nova data já usado hoje nas tarefas e grava o novo prazo.

## Layout

As três colunas aparecem à direita do nome do aluno, como etiquetas compactas com rótulo curto (AF / Ficha / Relatório) e cor do status. Em telas pequenas elas quebram para baixo do nome. A linha continua abrindo a ficha do aluno ao ser clicada; o clique no indicador não navega, apenas abre o menu. A linha atual de texto "Última aval. funcional" é substituída pelo novo indicador de Avaliação Funcional, com a data no tooltip.

## Detalhes técnicos

- `src/pages/CarteiraAlunos.tsx`: substituir a busca ad-hoc de avaliações por `fetchLastFuncionalDateBatch` + `severityForLastFuncional` (`src/lib/avaliacaoFuncional.ts`), garantindo paridade com a lista de alunos.
- Nova query paginada em `tarefas` filtrando `status <> 'concluida'` e `tipo_auto in ('atualizar_treino','relatorio_tecnico_forca','relatorio_tecnico_corrida')` para os alunos exibidos, agregada por `aluno_id` (usar o helper de paginação existente em `src/lib/supabasePaginado.ts` e evitar `.in()` com listas grandes via filtro por status/tipo + join em memória).
- Novo componente `src/components/carteira/StatusPills.tsx` com as três etiquetas, usando as classes `status-active` / `status-warning` / `status-urgent` e `DropdownMenu` do shadcn.
- Navegação reaproveita `getTaskActionTarget` de `src/lib/taskAction.ts`; "Reagendar" reutiliza o diálogo de reagendamento existente das tarefas, atualizando `data_limite`.
- Sem migration e sem mudança de RLS.
