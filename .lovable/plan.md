# Aba "Frequência" no perfil do aluno

Nova aba entre **Treinos** e **Avaliações** no perfil do aluno, mostrando a frequência real do aluno cruzando a agenda de treinos com o que ele registra no portal.

## O que a aba mostra

Uma linha por data agendada (mais recente primeiro), com:

- Data e horário do agendamento
- Situação da agenda: Agendado / Confirmado / Realizado / Cancelado
- Treino proposto para aquela data (ex.: T3 da Fase 1) — a variação que estava prevista na rotação
- Treino realizado (ex.: T4), quando o aluno registrou a conclusão no portal
- Selo "Trocado" quando o aluno concluiu uma variação diferente da proposta (o caso da Bruna Meyer em 12/08: proposto T3, realizado T4)
- Nome do programa/fase do treino executado

Acima da lista, um resumo do período: total de agendamentos, realizados, cancelados, taxa de comparecimento e nº de trocas.

Filtros: período (últimos 30/90 dias, ano, tudo) e situação.

Se o aluno não tem agendamentos, a aba mostra estado vazio explicando que a frequência é gerada pela agenda de treinos.

## Como o "proposto" é definido

- Se existe sessão registrada com troca, o proposto é a variação original guardada no registro e o realizado é a variação efetiva.
- Se existe sessão sem troca, proposto = realizado.
- Se a data está agendada e ainda não houve registro, o proposto é calculado pela rotação (T1→T2→T3→T4) a partir das sessões já concluídas em ordem de data, igual à lógica que o portal usa.

## Edição pela equipe (opcional)

Como muitos alunos não registram nada no portal, professor, coordenador e admin podem preencher a frequência manualmente:

- Em cada data agendada, um botão "Registrar treino" abre um seletor com as variações do programa vigente (T1, T2, T3, T4...).
- Se já existe registro, o botão vira "Alterar" e permite trocar a variação ou remover o registro.
- Ao salvar uma variação diferente da proposta, o sistema marca como troca (guardando a variação originalmente prevista) e a linha exibe o selo "Trocado".
- Salvar marca o agendamento como Realizado; remover devolve o agendamento para Confirmado — mesma mecânica que o portal já usa.
- Registros feitos pela equipe aparecem com a etiqueta "Registrado pela equipe" para diferenciar do que o aluno preencheu.
- Preenchimento é opcional: datas sem registro continuam listadas normalmente, apenas com o treino proposto.

## Detalhes técnicos

- Novo componente `src/components/student/StudentFrequencia.tsx`.
- Registro da aba em `src/pages/StudentProfile.tsx` (`TabsTrigger`/`TabsContent` valor `frequencia`, após `treinos`).
- Dados: `treino_agendamentos` (data, horários, status) com `left join` lógico em `treino_sessoes` por `agendamento_id`, e `treinos` para descrição/fase. Consultas via TanStack Query com `queryKey` `["student-frequencia", aluno_id, filtros]`.
- Sessões sem `agendamento_id` (registradas fora da agenda) entram na lista como linhas "sem agendamento" na data da sessão, para não sumirem do histórico.
- Gravação reaproveita a mesma lógica do portal: insert/update em `treino_sessoes` (`variacao`, `variacao_original`, `foi_troca`, `data`, `concluido_em`, `agendamento_id`) e update de `status` em `treino_agendamentos`. Essa lógica será extraída para um helper compartilhado para evitar divergência entre portal e perfil.
- Origem do registro derivada de `created_by`/contexto de auth; a etiqueta "Registrado pela equipe" usa esse dado — se não houver coluna disponível em `treino_sessoes`, o campo `observacoes` guarda a marcação.
- Escrita liberada por RLS a staff (`is_staff()` em `treino_sessoes` e `treino_agendamentos`); botões de edição visíveis apenas para professor, coordenador e admin. Nenhuma migração estrutural é necessária.
- Sem alteração no fluxo do portal do aluno nem na conclusão de treino existente.

