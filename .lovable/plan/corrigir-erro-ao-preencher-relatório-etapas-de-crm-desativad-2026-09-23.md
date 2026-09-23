# Corrigir erro ao preencher relatório (etapas de CRM desativadas)

## O que está acontecendo

Ao salvar um relatório, o sistema tenta mover o cadastro automaticamente para a etapa
"Avaliação realizada". Essa etapa foi desativada na reorganização do funil (junto com
"Avaliação agendada" e "Avaliação confirmada"), então a movimentação falha com
"Pipeline stage Avaliação realizada not found" — e, como o relatório não chega a ser gravado,
aparece em seguida "Preencha ao menos um campo antes de finalizar".

Isso só acontece com cadastros sem etapa definida ou em "Novo lead" — o caso do cliente avulso,
que não passa pelo funil comercial.

O mesmo problema existe na agenda: ao agendar uma avaliação ou um treino experimental, o sistema
tenta usar as etapas "Avaliação agendada" e "Aula experimental agendada", que também não existem
mais como etapas ativas.

## O que muda

- Clientes avulsos deixam de entrar em qualquer movimentação automática de CRM — nem pelo
  relatório, nem pela agenda. Eles seguem fora do funil, como esperado.
- Quando a etapa de destino não existir mais (ou estiver desativada), a movimentação simplesmente
  não acontece: o relatório e o agendamento são salvos normalmente, sem mensagem de erro.
- Na agenda, o treino experimental passa a usar a etapa ativa atual, "Treino experimental
  agendado", em vez do nome antigo.
- Quem está em etapa ativa do funil continua avançando exatamente como hoje.

## Detalhes técnicos

Migração com três ajustes, sem mudança de schema:

1. `trg_avaliacao_pipeline`: sai cedo (`RETURN NEW`) quando o aluno tem `status = 'avulso'`;
   antes de chamar `fn_move_pipeline`, confere se existe `pipeline_stages` com
   `name = 'Avaliação realizada' AND is_active = true` — se não existir, não move.
2. `trg_agenda_pipeline`: mesma proteção para `status = 'avulso'` e mesma checagem de existência
   da etapa; o ramo de experimental passa a mirar `'Treino experimental agendado'` (com fallback
   silencioso se não estiver ativa).
3. `fn_move_pipeline` permanece como está (continua levantando exceção em chamada manual com
   etapa inválida) — a tolerância fica nos gatilhos automáticos.

Validação: registrar um relatório para um cliente avulso e para um lead em etapa ativa, criar um
agendamento de avaliação e um de experimental, e conferir que nenhum erro aparece e que o
histórico do funil continua sendo gravado nos casos válidos.
