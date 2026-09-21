# Consultor responsável do aluno

## O que foi confirmado nos dados

- Marcos Fuhr está sob responsabilidade da Vanessa; Lisheng Zheng, do Jonas.
- Nicolas e Bruno têm perfil de administrador. No painel, o administrador com o filtro em "Todos os professores" vê alertas de **todos** os alunos — é por isso que a troca de ficha do Marcos aparece para o Nicolas e a reavaliação do Lisheng aparece para Nicolas e Bruno.
- A professora Vanessa só vê os alunos dela: o filtro por responsável já funciona para quem não é coordenador/admin.
- Hoje o aluno tem apenas **um** responsável (o professor). A figura de consultor existe só no funil comercial (num campo de "responsável comercial" preenchido em 4 de 1.820 alunos) e não chega ao painel, às tarefas nem à agenda.

## O que será feito

### 1. Criar o Consultor Responsável do aluno
- Novo campo "Consultor responsável" na ficha do aluno, ao lado do professor responsável, escolhido entre a equipe.
- Preenchimento automático quando o aluno vem do funil: o responsável comercial do lead passa a ser gravado como consultor do aluno na conversão e na importação.
- Preenchimento em massa na Carteira de Alunos: selecionar vários alunos e atribuir consultor, do mesmo jeito que já existe para professor.
- Os 4 alunos que já têm responsável comercial no funil recebem o consultor correspondente automaticamente; os demais ficam sem consultor até alguém definir.

### 2. Alertas e quadros do painel por carteira
Regra única, aplicada a todos os quadros (Alertas Técnicos, Tarefas Pendentes, Alertas de Plano, Aniversários, Indicadores e Carteira):

- Cada pessoa vê, por padrão, apenas os alunos em que ela é **professor responsável ou consultor responsável** — inclusive quem é administrador ou coordenador.
- Coordenador e administrador continuam com o seletor no topo do painel para escolher outro profissional ou "Todos" quando quiserem a visão da equipe; a diferença é que a visão inicial deixa de ser "todos".
- Reavaliação funcional e troca de ficha: aparecem para o professor responsável **e** para o consultor responsável do aluno, e não para os demais.
- Aluno sem consultor definido: comporta-se como hoje, aparecendo só para o professor responsável.

### 3. Tarefas
- Na Central de Tarefas, cada pessoa passa a ver também as tarefas dos alunos em que é consultor, além das atribuídas diretamente a ela.
- Tarefas criadas a partir do funil e do agendamento de serviços passam a carregar o aluno e o consultor, para que apareçam na Central de Tarefas de quem é responsável comercialmente.
- Nenhuma tarefa é duplicada: continua existindo uma tarefa com um responsável; o consultor ganha visibilidade, não uma cópia.

## Detalhes técnicos

- Migração aditiva: `alunos.consultor_id uuid null` com índice e backfill a partir de `pipeline_metadata.responsavel_comercial_id`. Sem remoção ou renomeação de colunas; `responsavel_id` permanece como está.
- Política de acesso: as regras de leitura de `alunos` e `tarefas` passam a considerar `consultor_id` além de `responsavel_id`, mantendo o padrão `is_staff()` para leitura e `is_admin()` para escrita.
- Novo helper de escopo no cliente (`useCarteiraScope`) devolvendo o conjunto de alunos do usuário (responsável ou consultor); `AlertsWidget`, `AdminAlertsWidget`, `TasksWidget`, `BirthdaysWidget`, `StatsCards`, `CarteiraAlunos` e `TaskCenter` passam a usá-lo em vez de comparar `responsavel_id` diretamente.
- `Dashboard.tsx` passa a iniciar o seletor de profissional no próprio usuário, com a opção "Todos" preservada para coordenador/admin.
- Ficha do aluno: `StudentFormFields`, `AddStudentDialog`, `EditStudentDialog` ganham o seletor de consultor; `ConvertToProspectDialog` e `studentImport` propagam o responsável comercial.
- Testes puros para a regra de escopo (responsável, consultor, ambos, nenhum) em `src/test`.
