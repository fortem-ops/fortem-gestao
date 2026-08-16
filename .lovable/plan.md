# Resumo diário (dia anterior) de Treino Experimental e Avaliação Funcional

## Item 2 — Relatório da investigação (o que existe hoje)

### Como funciona o `categoria='agendado'` com `horario_fixo` hoje

Só existe **um** mecanismo agendado em produção e ele é **exclusivo do módulo Ponto**:

- Cron `whatsapp-disparo-ponto-5min` (jobid 25), agenda `*/5 * * * *`, chama a edge function `whatsapp-disparo-ponto`.
- `supabase/functions/whatsapp-disparo-ponto/index.ts` tem uma lista fixa de gatilhos no código:
  `['lembrete_entrada','lembrete_intervalo_inicio','lembrete_intervalo_fim','lembrete_saida','resumo_diario_ponto']`,
  e busca em `whatsapp_disparos_config` por `categoria='agendado' AND gatilho IN (...)`.
- Ele calcula a hora atual em `America/Sao_Paulo`, aplica a janela `naJanela()` de 5 min (igual à frequência do cron) e, para o `resumo_diario_ponto`, usa `horario_fixo` apenas como **fallback** quando não há horário previsto na jornada — a âncora principal é saída real + 10 min ou fim previsto + 30 min.
- Idempotência: `jaEnviado(config_id, usuario_id, referencia_data)` sobre `whatsapp_disparos_log`, com status `enviado` ou `bloqueado_teste`.
- Envio: helpers de `supabase/functions/_shared/whatsapp.ts` (`normalizarTelefone`, `resolveNumberedTemplate` com placeholders `{{1}}`, `sendWhatsAppText`, `registrarNoChat`).
- `modo_teste=true` → grava log com status `bloqueado_teste` e **não** envia.

### Como funcionam os disparos de agenda (Reabilitação/Nutrição, Cancelamento)

- `whatsapp-disparo-agenda` é **event-driven**: recebe `{ evento, agenda_id }` na criação/cancelamento do agendamento, filtra `whatsapp_disparos_config` por `gatilho = evento AND ativo = true`, aplica o filtro `atividades`, e escolhe o template Meta por `configNome.startsWith(...)` em `buildTemplatePayload`. Não tem nenhuma noção de horário/cron.

### Conclusão sobre reaproveitamento

Nenhuma das duas funções serve como está:

- `whatsapp-disparo-ponto` é acoplado a `ponto_jornadas` / `ponto_horarios_professor` e à lista fixa de gatilhos; enfiar agenda lá misturaria dois domínios.
- `whatsapp-disparo-agenda` não é agendado e resolve um agendamento por vez, não um resumo consolidado por profissional.

**Recomendação:** nova edge function `whatsapp-resumo-agenda-amanha`, com cron próprio, copiando o padrão já validado do ponto (timezone SP, janela, log idempotente por `config_id + usuario_id + referencia_data`, helpers compartilhados). Nada dos disparos existentes é tocado.

### Observações relevantes para a implementação

- `whatsapp_disparos_log` já tem `usuario_id` e `referencia_data` — dá para reaproveitar o mesmo esquema de idempotência do ponto, sem migração de tabela.
- Os templates pedidos usam placeholders `%NOME_PROFISSIONAL%` etc., enquanto o caminho do ponto usa `{{1}}`. Para envio via template Meta aprovado, os parâmetros vão posicionais na ordem: nome, quantidade, data, lista.
- `%LISTA_AGENDAMENTOS%` precisa virar **uma linha só** (a Meta não aceita `\n` em parâmetro de body): a lista será montada com separador ` | ` ou `•`, no formato `08:00 João Silva • 09:00 Maria Souza`. Confirmo isso com você antes de submeter os templates.
- Fonte dos agendamentos: `agenda_servicos` filtrando `data_especifica = amanhã` e `atividade` conforme o campo `atividades` da config, agrupando por `profissional_id`.

## Próximos passos propostos (só executo após seu OK)

1. Inserir os dois registros em `whatsapp_disparos_config` (ativo=false, modo_teste=true) exatamente como especificado.
2. Criar `supabase/functions/whatsapp-resumo-agenda-amanha` e o cron `*/5 * * * *` (a função só dispara na janela do `horario_fixo` 20:40 SP).
3. Não alterar nenhum disparo existente nem os dois registros históricos desativados.

## Pergunta em aberto

Confirmar o separador de `%LISTA_AGENDAMENTOS%` (linha única) antes de você submeter os templates à Meta.
