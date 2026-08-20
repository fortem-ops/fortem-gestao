# Ativar disparo real e reenviar os 4 avisos de 20/08

## Resposta à pergunta de idempotência

Sim. A função `whatsapp-resumo-agenda-amanha` considera "já enviado" qualquer log da combinação `config_id + agenda_id` cujo status esteja em `('enviado', 'bloqueado_teste')`. O `force: true` só ignora o filtro `ativo` e a janela de horário — não ignora essa checagem. Logo, apenas desligar `modo_teste` e reinvocar resultaria em `status: ja_enviado` para os 4 agendamentos, sem envio real.

Dados confirmados dos 4 logs (todos `referencia_data = 2026-08-20`, `status = bloqueado_teste`, telefone preenchido):

| Profissional | Atividade | Horário | Config |
|---|---|---|---|
| Vanessa Moreira Coutinho | Treino Experimental | 07:30 | Resumo Treino Experimental (dia anterior) |
| Cristiano Ransolin | Avaliação Funcional | 08:00 | Resumo Avaliação Funcional (dia anterior) |
| Jonas Santos Hubner | Avaliação Funcional | 10:00 | Resumo Avaliação Funcional (dia anterior) |
| Nicolas Squeff Janovik | Avaliação Funcional | 11:00 | Resumo Avaliação Funcional (dia anterior) |

Ambas as configs estão `ativo = true` com `horario_fixo = 20:40` e `modo_teste = true`.

## Plano de ação

1. **Desligar o modo teste** nas duas configs (`Resumo Treino Experimental (dia anterior) → Profissional` e `Resumo Avaliação Funcional (dia anterior) → Profissional`): `modo_teste = false`.

2. **Liberar o reprocessamento dos 4 registros.** Em vez de apagar, marcar os 4 logs com um status neutro que não conta como enviado — `status = 'reprocessado_teste'` — preservando o histórico de que o modo teste rodou às 20:40. A checagem de idempotência olha só por `enviado`/`bloqueado_teste`, então esse rename já libera o reenvio sem tocar no código da função. (Se preferir apagar de vez, é uma linha de diferença — só avisar.)

3. **Invocar a função manualmente agora** com `{"force": true}`, para ignorar a janela das 20:40 já passada. Ela recalcula "amanhã" sozinha: hoje é 19/08 em America/Sao_Paulo, então o alvo continua 20/08.

4. **Verificar o envio real**, não só o log: ler a resposta da invocação (que carrega `error`/`details` vindos da API do WhatsApp por agendamento), conferir os logs da edge function `send-whatsapp` para as 4 chamadas e reconsultar `whatsapp_disparos_log` para confirmar `status = 'enviado'` com `erro_detalhe` nulo. Se a Meta rejeitar algum template, mostro o payload de erro exato.

## Observação sobre o cron

Com `modo_teste = false` a partir de agora, as próximas execuções às 20:40 passam a enviar de verdade — comportamento desejado, mas vale registrar que não é só um reenvio pontual.

## Notas técnicas

- Nenhuma mudança de código é necessária: a idempotência baseada em status já permite a liberação por atualização do log.
- Os passos 1 e 2 são atualizações de dados (`whatsapp_disparos_config`, `whatsapp_disparos_log`), sem alteração de schema.
- O passo 3 usa a chamada direta à edge function autenticada, sem esperar o cron.
