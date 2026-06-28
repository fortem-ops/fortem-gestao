# ponto-banco-expirar

Expira automaticamente o saldo positivo do banco de horas acumulado antes do período de validade configurado em `ponto_configuracoes.banco_horas_validade_meses` (linha global, `usuario_id IS NULL`).

- Se `banco_horas_validade_meses` for `NULL` → não faz nada.
- Calcula data de corte = hoje − N meses.
- Para cada profissional (`professor` ou `admin`): soma todos os lançamentos com `data < corte`. Se saldo > 0, insere lançamento com `tipo = 'expiracao'` e `minutos = -saldo`, anulando o crédito antigo.

## Agendamento (já criado via migration)

Cron job `ponto-banco-expirar-mensal` roda no dia 1 de cada mês às 02h UTC.

## Teste manual

```bash
curl -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/ponto-banco-expirar" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
