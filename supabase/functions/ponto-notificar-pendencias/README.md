# ponto-notificar-pendencias

Job diário (22h, seg-sex) que verifica jornadas de ponto abertas sem saída registrada e notifica:
- O próprio profissional com a jornada pendente.
- Todos os coordenadores e admins (notificação consolidada).

Usa a infraestrutura existente de notificações (`fn_notificar_criar_notificacao`).

## Ativar via pg_cron

No SQL Editor do backend:

```sql
select cron.schedule(
  'ponto-pendencias-diario',
  '0 22 * * 1-5',
  $$
  select net.http_post(
    url := '<PROJECT_URL>/functions/v1/ponto-notificar-pendencias',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
```

Para desativar:

```sql
select cron.unschedule('ponto-pendencias-diario');
```

## Testar manualmente

```bash
curl -X POST \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  <PROJECT_URL>/functions/v1/ponto-notificar-pendencias
```

Resposta:

```json
{ "notificados": 3, "coordsAlertados": true, "total_pendentes": 3 }
```

## Logs

Acompanhe no painel de Edge Functions → Logs (prefixo `[ponto-pendencias]`).
