# Incluir aluno no horário: só ativos e créditos de planos antigos

## O que muda para a equipe
1. **Lista de alunos ao incluir no horário**: mostra alunos ativos de fato (cadastro "ativo", fora da equipe, com plano ou contrato vigente hoje, incluindo Wellhub/TotalPass) **e prospects**, separados em dois grupos ("Alunos" e "Prospects"). Leads, inativos, avulsos e quem está "ativo" sem plano vigente deixam de aparecer.
2. **Prospect incluído em um horário de treino = Treino Experimental**: ao escolher um prospect, em vez de incluir direto, abre a mesma janela de agendamento da Agenda de Serviços já preenchida com atividade "Treino Experimental", data, horário, local e professor do horário (professor responsável do prospect quando houver), mostrando anamnese e o campo de consultor. Ao salvar:
   - cria o Treino Experimental na Agenda de Serviços (com os avisos e WhatsApp que já existem hoje);
   - inclui o prospect no horário de treino, sem consumir crédito;
   - se o Treino Experimental for cancelado, o prospect sai do horário de treino (e vice-versa).
   - Prospect não mostra saldo de créditos; aparece "Prospect · Treino Experimental".
3. **Créditos de alunos com planos antigos (antes de 2027)**: ao selecionar o aluno, aparece o saldo de treinos dele, como já acontece nos planos 2027.
   - Total do plano anual pela frequência: 1x = 52, 2x = 104, 3x = 156 (proporcional quando o contrato tiver outra duração).
   - Usados = treinos agendados/realizados (não cancelados) dentro do período do contrato vigente, incluindo os horários fixos já lançados.
   - Livre (Seg–Sex) continua "não consome créditos"; agregadoras continuam sem saldo numérico.
   - Texto: "X créditos restantes de Y" com o nome do plano.

## O que fica igual
Planos 2027 (ciclos de crédito), inclusão sem limite para Admin/Coordenador, exclusão com escolha de estorno, portal do aluno e regras de débito.

## Detalhes técnicos
- Achado: os contratos antigos não têm linhas em `ciclos_credito` (ex.: contrato Power 3x ativo sem ciclo), e `fn_saldo_creditos_treino_aluno` só soma ciclos, por isso retorna 0. Hoje 119 alunos com status ativo não têm ciclo ativo.
- Migration nova substituindo só `fn_saldo_creditos_treino_aluno`: quando não houver ciclo ativo, usar o contrato ativo vigente (`contratos.frequencia_semanal`, `data_inicio`, `data_fim`) para o total e contar `treino_agendamentos` do aluno no período com status diferente de cancelado. Plano principal continua vindo de `fn_plano_principal_ativo`. Retorna `origem: 'legado'`.
- Nova RPC `fn_alunos_agendaveis_equipe()` (SECURITY DEFINER, search_path fixo, só admin/coordenador, sem anon) que devolve id/nome dos alunos ativos com plano/contrato vigente; `IncluirAlunoHorario.tsx` passa a usá-la.
- Prospects: `fn_agendar_treino_equipe` ganha `p_agenda_servico_id` opcional; para aluno com status prospect exige esse vínculo, não debita crédito e grava o vínculo em `treino_agendamentos` (nova coluna nullable `agenda_servico_id`). O fluxo usa `AddAgendaDialog` com `prefill` (atividade, data, horários, local, profissional, aluno) e, no sucesso, chama a RPC. Gatilho em `agenda_servicos` cancela o treino vinculado quando o experimental é cancelado/excluído; cancelar o treino vinculado cancela o experimental.
- Testes: regressão para prospect (sem débito, exige experimental, cancelamento em cascata),  para aluno legado 3x (156 menos usados), Livre, agregadora e filtro da lista; ensaio SQL revertido com fixtures; `bunx vitest run` e eslint nos arquivos alterados.
