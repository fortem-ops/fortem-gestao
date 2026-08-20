# Pausar comissionamento e tarefas de Avaliação Funcional

Mudança de processo: a avaliação passou a ser feita pela Avaliação Premium. Enquanto o novo modelo não é definido, o sistema para de gerar comissões e tarefas de avaliação funcional, e o que já está acumulado é limpo.

O comissionamento de **Treino Experimental** e de **Carteira Ativa** continua funcionando normalmente.

## O que será feito

**1. Pausar o lançamento (nada novo é criado)**
- Desativar a regra de comissão "Avaliação Funcional" no cadastro de comissionamento (fica desligada, valor preservado para reativar depois).
- Parar a criação automática de pendências de "Concluir Avaliação Funcional" e "Upload de arquivo Força" quando uma avaliação funcional é agendada, lançada ou tem laudo anexado.
- Desligar a rotina diária das 10h que cria a tarefa "Agendar reavaliação funcional" para todo aluno com mais de 4 meses sem avaliação.
- Parar a criação de tarefa de reavaliação disparada quando uma pendência é concluída.

**2. Limpar o acumulado**
- Cancelar as 134 comissões de Avaliação Funcional com status pendente, com observação indicando a pausa por mudança de processo. A que já está aprovada e as canceladas permanecem como estão.
- Remover as 12 pendências em aberto de avaliação funcional (7 de "Concluir Avaliação Funcional" e 5 de "Upload de arquivo Força"). As 33 de Treino Experimental ficam intactas.
- Apagar as 585 tarefas pendentes de "Agendar reavaliação funcional". Tarefas já concluídas ficam no histórico.

## Como reativar depois

A pausa é reversível: basta reativar a regra de comissão, o agendamento diário e restaurar os gatilhos. Nada é excluído em definitivo além das tarefas/pendências antigas.

## Detalhes técnicos

- Migration:
  - `UPDATE comissionamento_config SET ativo = false WHERE tipo = 'avaliacao_funcional'` (já basta para `fn_comissao_valor` retornar 0 e `fn_gerar_comissao` não inserir).
  - Guarda de saída antecipada nas funções `trg_comissao_agenda_insert` (ramo `Avaliação Funcional`), `trg_comissao_avaliacao_insert`, `trg_comissao_avaliacao_v2_update`, `trg_comissao_anexo_insert` e `trg_pendencia_reavaliacao_4m`, condicionada a `comissionamento_config.ativo` do tipo `avaliacao_funcional` — assim reativar a config religa tudo sem nova migration.
  - `fn_agendar_reavaliacoes_pendentes` retorna imediatamente (`pausado: true`) quando a config está inativa; o cron job `agendar-reavaliacoes-funcionais-diario` permanece agendado mas não cria nada.
- Limpeza de dados (operação de dados, não migration):
  - `comissionamentos`: `status = 'cancelado'`, `observacoes` anotada, onde `tipo = 'avaliacao_funcional' AND status = 'pendente'`.
  - `comissionamento_pendencias`: delete de `tipo_pendencia IN ('concluir_avaliacao_funcional','upload_arquivo_forca') AND concluido = false`.
  - `tarefas`: delete de `tipo_auto = 'reavaliacao_funcional' AND status <> 'concluida'`.
- Sem alteração de front-end.
