# Lembretes de Ponto via WhatsApp — Relatório de investigação e proposta

Fase 1: investigação apenas. Nenhuma alteração de código ou banco foi feita.

## 1. Como funcionam hoje os disparos WhatsApp

Descoberta principal: **a categoria "agendado" não é processada por nenhum cron job hoje.**

- A única função de disparo é `whatsapp-disparo-agenda`. Ela é **orientada a evento**, não a horário: recebe `{ evento, agenda_id }` no corpo da requisição e é chamada pelo front-end em `src/pages/Agenda.tsx` e `src/components/agenda/AddAgendaDialog.tsx` quando um agendamento é criado ou cancelado.
- Ela busca em `whatsapp_disparos_config` as linhas com `gatilho = evento` e `ativo = true`, monta as variáveis a partir da agenda/aluno/profissional, envia via `send-whatsapp` e grava em `whatsapp_disparos_log`.
- Anti-duplicidade: função `alreadySent(agenda_id, config_id)` — consulta `whatsapp_disparos_log` por `agenda_id + config_id` com status `enviado` ou `bloqueado_teste`. Ou seja, **a deduplicação depende de existir um `agenda_id`**.
- Os dois registros de categoria "agendado" (`lembrete_dia_anterior`, `lembrete_renovacao`) existem na tabela desde a migração de 09/07, mas estão com `ativo = false` e `modo_teste = true`, e nada os invoca. São configurações órfãs.
- Não há coluna de horário na tabela: `whatsapp_disparos_config` tem apenas `id, nome, descricao, categoria, gatilho, destinatario, atividades[], ativo, modo_teste, template_texto, variaveis_disponiveis[], ordem, timestamps`. Não existe `horario_envio` nem `antecedencia_min`.
- `whatsapp_disparos_log` tem `config_id, agenda_id, aluno_id, destinatario_telefone, destinatario_nome, mensagem_enviada, status, erro_detalhe, created_at`. Não tem `usuario_id` nem `referencia_data`.

Conclusão: para lembretes de ponto será preciso **criar o mecanismo de agendamento do zero** (cron + nova edge function), e estender o log para permitir deduplicação sem `agenda_id`.

## 2. `ponto_horarios_professor`

- Colunas: `usuario_id, dia_semana (smallint), horario_inicio (time), horario_fim (time), intervalo_min (smallint), ativo, frequencia_mensal`.
- **Constraint UNIQUE (usuario_id, dia_semana)** — portanto é impossível haver dois horários no mesmo dia para o mesmo profissional. Não existe caso manhã+noite; jornada partida hoje só seria representada como uma janela única com intervalo.
- `dia_semana` segue a convenção de `EXTRACT(dow)` / `Date.getDay()`: 0 = domingo … 6 = sábado. A UI de admin só expõe segunda (1) a sábado (6).
- Estado atual: 25 horários ativos distribuídos entre 5 profissionais.
- `intervalo_min` assume 0, 15 ou 60. A UI força `intervalo_min = 0` quando a janela é ≤ 4h.
- Fallback quando não há horário no dia: `ponto_configuracoes.carga_diaria_min` (linha do usuário, senão a linha global com `usuario_id IS NULL`, senão 480).

## 3. Verificar batidas já registradas

`ponto_jornadas` tem **UNIQUE (usuario_id, data)** — no máximo uma linha por profissional por dia. A consulta é direta:

```sql
SELECT entrada, intervalo_inicio, intervalo_fim, saida, status
FROM public.ponto_jornadas
WHERE usuario_id = :uid AND data = :data;
```

Regra de decisão por lembrete:
- linha ausente ou `entrada IS NULL` → só o lembrete de **entrada** faz sentido.
- `entrada IS NOT NULL AND intervalo_inicio IS NULL` → cabe lembrete de **intervalo** (se `intervalo_min > 0`).
- `intervalo_inicio IS NOT NULL AND intervalo_fim IS NULL` → cabe lembrete de **retorno do intervalo**.
- `entrada IS NOT NULL AND saida IS NULL` → cabe lembrete de **saída**.
- `saida IS NOT NULL` → nada a lembrar; o dia entra no resumo.

Atenção crítica de fuso: o banco roda em **UTC** (`current_setting('TimeZone') = 'UTC'`). `CURRENT_DATE` vira o dia seguinte às 21h de Brasília. Toda comparação de data/horário nos lembretes deve calcular o dia e a hora em `America/Sao_Paulo` explicitamente (`(now() AT TIME ZONE 'America/Sao_Paulo')::date`), nunca `CURRENT_DATE` puro.

## 4. Ausências (feriados / férias)

- `ponto_feriados`: `data, descricao, tipo (nacional | estadual | municipal | facultativo | recesso), created_by`. É global, não tem `usuario_id`.
- `ponto_ferias`: `usuario_id, data_inicio, data_fim, tipo (ferias | folga | atestado | licenca), observacao`.

Já existe a função pronta para essa checagem — reutilizar em vez de duplicar lógica:

```sql
SELECT public.fn_ponto_dia_ausencia(:uid, :data);
```

Retorna `'feriado'` (prioridade 1) ou o tipo da ausência individual (prioridade 2), e `NULL` quando o profissional deve trabalhar. Proposta: **nenhum disparo se o retorno for não-nulo**, exceto feriado do tipo `facultativo`, que pode ser tratado como dia normal (a definir com o gestor).

Checagens adicionais recomendadas antes de qualquer envio:
1. `fn_ponto_dia_ausencia` = NULL.
2. Existe `ponto_horarios_professor` ativo para `(usuario_id, dow)`.
3. Se `dia_semana = 6` (sábado), respeitar `frequencia_mensal` (1–4 sábados/mês).
4. Profissional ainda tem role ativa de staff e telefone em `profiles.phone` (hoje todos os 5 têm telefone cadastrado).

## 5. Proposta técnica dos 4 novos disparos

### Estrutura de dados

Novas colunas em `whatsapp_disparos_config` (nullable, não quebram o fluxo atual):
- `offset_min integer` — deslocamento em minutos relativo ao horário-âncora. Negativo = antes. Ex.: `-10` para lembrar 10 min antes da entrada.
- `horario_fixo time` — usado apenas pelo resumo diário, que não depende de horário individual.

Novas colunas em `whatsapp_disparos_log` (para deduplicar sem `agenda_id`):
- `usuario_id uuid`
- `referencia_data date`
- índice único parcial em `(config_id, usuario_id, referencia_data)` quando `usuario_id IS NOT NULL` e `status = 'enviado'`.

### As 4 configurações

| nome | gatilho | âncora | offset sugerido | condição de envio |
|---|---|---|---|---|
| Lembrete de Entrada → Profissional | `lembrete_entrada` | `horario_inicio` | +10 min | `entrada IS NULL` |
| Lembrete de Intervalo → Profissional | `lembrete_intervalo` | `horario_inicio + (janela/2)` | 0 | `intervalo_min > 0` e `intervalo_inicio IS NULL` e `entrada IS NOT NULL` |
| Lembrete de Saída → Profissional | `lembrete_saida` | `horario_fim` | +10 min | `entrada IS NOT NULL` e `saida IS NULL` |
| Resumo Diário de Ponto → Profissional | `resumo_diario_ponto` | `horario_fixo` | — (ex.: 20:00) | sempre que houve jornada prevista no dia |

Todas: `categoria = 'agendado'`, `destinatario = 'profissional'`, `ativo = false` e `modo_teste = true` na criação, para ativação controlada pelo gestor.

Variáveis do template: `%NOME_PROFISSIONAL%`, `%DATA%`, `%DIA_SEMANA%`, `%HORA_PREVISTA%`, `%HORA_ENTRADA%`, `%HORA_SAIDA%`, `%INTERVALO_MIN%`, `%TEMPO_TRABALHADO%`, `%STATUS_DIA%`.

### Mecanismo de execução

Nova edge function `whatsapp-disparo-ponto`, disparada por cron a cada 5 minutos (mesmo padrão de `notify-agenda-proximos-5min`), executando:

1. Calcula agora e hoje em `America/Sao_Paulo`.
2. Carrega os configs ativos de categoria `agendado` com gatilho de ponto.
3. Para cada profissional com `ponto_horarios_professor` ativo no dia da semana atual:
   - pula se `fn_ponto_dia_ausencia` retornar algo;
   - calcula o horário-alvo de cada lembrete (`âncora + offset`);
   - envia se agora estiver dentro da janela de tolerância do alvo (alvo ≤ agora < alvo + 5 min);
   - checa a jornada em `ponto_jornadas` e pula se a batida já existe;
   - checa `whatsapp_disparos_log` por `(config_id, usuario_id, hoje)` e pula se já enviado;
   - envia via `send-whatsapp` (texto livre) e grava no log + `whatsapp_mensagens`, reaproveitando os helpers já existentes em `whatsapp-disparo-agenda`.
4. Resumo diário: quando a hora atual bate com `horario_fixo`, monta o consolidado do dia (entrada, intervalo, saída, minutos trabalhados, status) e envia.

Recomendação: extrair `normalizarTelefone`, `callSendWhatsApp`, `sendWhatsAppText` e a gravação no chat de `whatsapp-disparo-agenda` para `supabase/functions/_shared/whatsapp.ts`, evitando duplicação entre as duas funções.

### Pontos que precisam de decisão do gestor antes da Fase 2

1. Offsets exatos de cada lembrete (proposta: entrada +10, saída +10).
2. Horário do resumo diário (proposta: 20:00).
3. Feriado facultativo conta como dia útil para o ponto?
4. O resumo diário vai também para coordenação/admin ou só para o próprio profissional?
5. Sábado: respeitar `frequencia_mensal` exige saber quais sábados do mês valem — hoje o campo só guarda a quantidade, não quais datas.
