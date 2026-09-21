# Consultor responsável e Carteira Consultor

## O que foi confirmado nos dados

- Marcos Fuhr está sob responsabilidade da Vanessa; Lisheng Zheng, do Jonas.
- Nicolas e Bruno têm perfil de administrador. No painel, o administrador com o filtro em "Todos os professores" vê alertas de **todos** os alunos — por isso a troca de ficha do Marcos aparece para o Nicolas e a reavaliação do Lisheng aparece para Nicolas e Bruno.
- A professora Vanessa só vê os alunos dela: o filtro por responsável já funciona para quem não é coordenador/admin.
- Hoje o aluno tem apenas **um** responsável (o professor). A figura de consultor existe só no funil comercial (campo de "responsável comercial", preenchido em 4 de 1.820 alunos) e não chega ao painel, às tarefas nem à agenda.

## 1. Criar o Consultor Responsável do aluno

- Novo campo "Consultor responsável" na ficha do aluno, ao lado do professor responsável, escolhido entre a equipe.
- Preenchimento automático na conversão do funil e na importação: o responsável comercial do lead passa a ser gravado como consultor do aluno.
- Atribuição em massa: selecionar vários alunos e definir consultor, como já existe para professor.
- Os 4 alunos que já têm responsável comercial recebem o consultor correspondente na migração; os demais ficam sem consultor até alguém definir.

## 2. Alertas e quadros do painel por carteira

Regra única para Alertas Técnicos, Tarefas Pendentes, Alertas de Plano, Aniversários, Indicadores e Carteira:

- Cada pessoa vê por padrão apenas os alunos em que é **professor responsável ou consultor responsável** — inclusive administrador e coordenador.
- Coordenador e administrador mantêm o seletor no topo para ver outro profissional ou "Todos"; muda só a visão inicial.
- Troca de ficha e reavaliação funcional aparecem para o professor **e** para o consultor do aluno, e não para os demais.
- Aluno sem consultor: continua aparecendo só para o professor responsável.

## 3. Tarefas

- Na Central de Tarefas, cada pessoa passa a ver também as tarefas dos alunos em que é consultor.
- Tarefas vindas do funil e do agendamento de serviços passam a carregar aluno e consultor, para aparecerem na Central de Tarefas de quem responde comercialmente.
- Nenhuma tarefa é duplicada: o consultor ganha visibilidade, não uma cópia.

## 4. Nova tela Cadastros > Carteira Consultor

Mesma estrutura da Técnico > Carteira de Alunos, agrupada por **consultor** em vez de professor, com a carteira do próprio usuário em primeiro lugar, busca por nome, filtro por consultor e atribuição em massa.

Colunas por aluno:

- **Consultor responsável** (com "Sem consultor" para quem ainda não tem).
- **Avaliação funcional**: em dia (última há menos de 4 meses), pendente (4 a 6 meses) ou atrasada (6 meses ou mais) — os mesmos cortes já usados nos alertas do painel.
- **Frequência**: assíduo ou irregular, comparando as sessões realizadas nas últimas 4 semanas com a frequência semanal contratada; assíduo a partir de 75% do previsto. Sem frequência contratada ou sem agendamentos, mostra "sem dados".
- **Situação no funil**: etapa atual do aluno no pipeline, com a cor da etapa; "fora do funil" quando não houver registro.

Tarefa automática: quando a avaliação funcional do aluno estiver pendente ou atrasada, é criada uma tarefa de reavaliação para o professor responsável, com o consultor vinculado ao aluno enxergando a mesma tarefa. A tarefa é criada uma única vez por aluno enquanto estiver aberta, com prazo maior para "pendente" e prioridade alta para "atrasada".

## Detalhes técnicos

- Migração aditiva: `alunos.consultor_id uuid null` com índice e backfill a partir de `pipeline_metadata.responsavel_comercial_id`. Sem remoção/renomeação; `responsavel_id` permanece.
- Políticas de leitura de `alunos` e `tarefas` passam a considerar `consultor_id` além de `responsavel_id`, mantendo `is_staff()` para leitura e `is_admin()` para escrita.
- Novo helper `useCarteiraScope` devolvendo o conjunto de alunos do usuário (responsável ou consultor); `AlertsWidget`, `AdminAlertsWidget`, `TasksWidget`, `BirthdaysWidget`, `StatsCards`, `CarteiraAlunos` e `TaskCenter` passam a usá-lo.
- `Dashboard.tsx` inicia o seletor de profissional no próprio usuário, mantendo "Todos" para coordenador/admin.
- Ficha do aluno: `StudentFormFields`, `AddStudentDialog`, `EditStudentDialog` ganham o seletor de consultor; `ConvertToProspectDialog` e `studentImport` propagam o responsável comercial.
- Nova página `src/pages/CarteiraConsultor.tsx` em `/carteira-consultor`, item em Cadastros no `AppSidebar`, reaproveitando a consulta de alunos ativos (`selecionarPlanoExibicao` + `getDisplayStatus`), `fetchLastFuncionalDateBatch`, `StatusPills` e as sessões de `frequenciaTreino`; etapa do funil via `pipeline_metadata` + `pipeline_stages`.
- Criação da tarefa de reavaliação reutiliza `fn_criar_tarefa_reavaliacao`, com verificação de tarefa aberta do mesmo tipo para o aluno antes de criar.
- Testes puros: regra de escopo (responsável, consultor, ambos, nenhum), classificação da avaliação funcional e cálculo de assiduidade.
