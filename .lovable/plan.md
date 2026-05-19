## Objetivo

Permitir que **Professores, Coordenadores e Administradores** editem manualmente a data da última avaliação funcional de um aluno. Isso é útil principalmente para alunos legados que já realizaram avaliações no passado fora do sistema.

As regras existentes (cores ≤4m/4-6m/>6m, tarefa automática de reavaliação após 4 meses, agendamento via cron diário) **continuam funcionando da mesma forma** — uma data editada manualmente passa a ser tratada como uma avaliação real para todos os fins.

## Abordagem

Em vez de alterar `avaliacoes` ou `agenda_servicos` (que carregam dados clínicos e comissionamento), criar um registro tipo "marco histórico" em `avaliacoes` com flag indicando origem manual. Assim:

- O helper `fetchLastFuncionalDateBatch` continua somando todas as fontes sem mudanças.
- Os triggers de reavaliação (`trg_aval_reavaliacao_4m`) disparam normalmente e agendam a tarefa para 4 meses depois.
- O Histórico de Avaliações mostra o registro com um badge "Registro histórico" para não confundir com avaliação completa.

## Mudanças

### 1. Banco de dados (migração)

- Adicionar coluna `origem text` em `avaliacoes` (valores: `sistema` padrão, `historico_manual`).
- Ajustar trigger `trg_aval_reavaliacao_4m` para também aceitar registros com `origem = 'historico_manual'` (já aceita por ser `tipo = 'funcional'`, apenas garantir).
- RLS de INSERT em `avaliacoes` já permite qualquer autenticado com `avaliador_id = auth.uid()` — Professor/Coord/Admin já contemplados.

### 2. UI

**`StudentAssessments.tsx`** — adicionar botão "Editar data da última avaliação" ao lado do header "Última Avaliação Funcional":

- Abre um diálogo com um único campo (shadcn DatePicker) limitado a datas passadas (≤ hoje).
- Texto explicativo: "Use para registrar uma avaliação funcional realizada anteriormente fora do sistema."
- Confirmação cria um registro em `avaliacoes` com:
  - `tipo = 'funcional'`
  - `data = <data escolhida>`
  - `aluno_id = student.id`
  - `avaliador_id = auth.uid()`
  - `origem = 'historico_manual'`
  - `observacoes = 'Data registrada manualmente'`
  - `dados = {}`
- Após salvar: invalidar queries `last_funcional_aluno`, `avaliacoes-aluno`, `alunos_with_last_funcional` (lista).

**`StudentList.tsx`** — sem mudanças (já lê via helper batch).

**Histórico** — registros `origem = 'historico_manual'` recebem badge "Registro histórico" no card do `StudentAssessments` para diferenciar visualmente.

### 3. Permissões de acesso ao botão

Mostrar botão se o usuário tiver papel `professor`, `coordenador` ou `admin`. Usar `userHasStaffAccess` já existente em `src/lib/authAccess.ts` via hook simples (`useQuery` no componente).

## Fora de escopo

- Não editar/alterar avaliações existentes da tabela `avaliacoes` (continua só pelo dono via tela de Avaliações).
- Não criar comissionamento para o registro histórico (não passa por `comissionamento_pendencias`).
- Sem alterações em `agenda_servicos`.
- Cron diário e triggers permanecem inalterados em lógica — apenas se beneficiam do novo registro.
