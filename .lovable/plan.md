# Tarefa do Marcos Fuhr aparecendo com o Nicolas

## O que eu encontrei

O Marcos Fuhr é aluno da Vanessa — no cadastro dele a responsável é a Vanessa, e as tarefas atuais dele (atualizar treino de agosto, relatório técnico e reavaliação) estão todas com ela.

O que você viu é uma tarefa **antiga e solta**, criada em 02/06/2026: "Atualizar treino — Marcos Fuhr", com o Nicolas como responsável. Essa tarefa não está ligada ao cadastro do aluno (ficou sem vínculo), então:

- ela não foi substituída quando o treino do Marcos foi atualizado em agosto (a substituição só encontra tarefas ligadas ao aluno);
- ela não acompanhou a troca de professor;
- hoje existem duas tarefas de "atualizar treino" para o Marcos: a antiga com o Nicolas e a atual com a Vanessa.

Não é um caso isolado: existem **12 tarefas de "Atualizar treino" sem vínculo com aluno**, criadas entre 07/05 e 09/06/2026 (a maioria com o Gustavo como responsável). Depois dessa data as tarefas passaram a ser criadas já ligadas ao aluno, ou seja, o problema não se repete em tarefas novas.

## O que proponho fazer

1. **Limpeza dessas 12 tarefas soltas**, cada uma pelo nome que está no título:
   - Quando o aluno **já tem** uma tarefa de atualizar treino em aberto (caso do Marcos, e mais 6): a tarefa antiga e duplicada é encerrada. Fica só a atual, com o professor certo.
   - Quando o aluno **não tem** tarefa em aberto (4 casos: Cátia, Lisane, Izza, Amanda): a tarefa é ligada ao cadastro do aluno e passa para o professor responsável atual.
   - Um caso ("Taös Luise Denicol") não tem cadastro de aluno com esse nome — vou listar para você decidir; sem sua confirmação, não encerro.
2. **Conferência depois da limpeza**: nenhuma tarefa de atualizar treino em aberto sem vínculo de aluno, e nenhum aluno com duas.
3. Nada muda nas telas nem nas regras de criação de tarefas — a criação já está correta hoje.

## Detalhes técnicos

- Correção só de dados, via consultas na tabela `tarefas`; sem migration e sem alteração de código.
- Duplicadas: `status = 'concluida'` (não apago, mantém rastro).
- Órfãs reaproveitáveis: preenche `aluno_id` pelo nome do título (comparação sem diferenciar maiúsculas) e `responsavel_id = alunos.responsavel_id`.
- Fora de escopo: o alerta e o filtro de consultor já ajustados, e a criação de tarefa de atualizar treino nos métodos (5-3-1, M102, Plan Strong, Planilha 5RM), que hoje não geram essa tarefa.
