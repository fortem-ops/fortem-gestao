## Objetivo
No seletor de aluno (`StudentPicker`), nunca listar cadastros de Lead/Prospect. Mostrar apenas alunos **Ativos** e em **Licença**. Aplica-se a todos os usos do componente (inclui o fluxo "Importar de Aluno" em prescrição de treino).

## Como identificar Lead/Prospect na tabela `alunos`
- Hoje o `StudentPicker` faz `select id, nome, status` sem filtro.
- Lead/Prospect são identificados por `current_pipeline_stage_id` apontando para uma stage cujo `name` é `Novo lead`, `Prospect` ou `Treino experimental agendado` (mesma regra já usada em `GlobalCadastroSearch.tsx` e `PipelineKanban.tsx`).
- `status` na tabela pode ser `ativo`, `licenca`, `inativo`, `encerrado`, `lead`, `prospect`.

## Mudanças

### 1. `src/components/student/StudentPicker.tsx`
- Buscar também `current_pipeline_stage_id`.
- Carregar `pipeline_stages (id, name)` em paralelo (cache `staleTime` 5 min, igual ao `GlobalCadastroSearch`).
- Construir mapa `stageId → name` e filtrar a lista antes de renderizar:
  - Excluir se `status in ('lead','prospect','inativo','encerrado')`.
  - Excluir se a stage atual estiver em `['Novo lead','Prospect','Treino experimental agendado']` (cobre alunos com `status='ativo'` mas ainda no funil).
  - Manter `status in ('ativo','licenca')` ou `status` nulo sem stage de funil.
- Ajustar o rótulo lateral: hoje mostra `(status)` quando `!== 'ativo'`; passar a mostrar somente `(licença)` quando aplicável.
- Atualizar `queryKey` para `['alunos-picker', 'ativos-licenca']` para invalidar cache antigo.

### 2. Sem outras alterações
- `ImportFromStudentDialog.tsx` e demais consumidores do `StudentPicker` (ex.: agenda, prescrições, comissionamento) herdam o filtro automaticamente — nenhum ajuste necessário.
- Não mexer em pipeline, leads, conversão, ou regras de negócio.

## Verificação
- Abrir `/banco-treinos` → aplicar treino a um aluno → clicar em "Importar de Aluno": o dropdown deve listar apenas alunos Ativos e em Licença, sem Leads/Prospects.
- Conferir um outro consumidor do `StudentPicker` (ex.: agenda) para confirmar consistência.
