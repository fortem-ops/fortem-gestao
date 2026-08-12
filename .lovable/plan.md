# Nova cobrança de teste em rede-cobrar-token

## Confirmação do código (já verificada)

O payload atual em `supabase/functions/rede-cobrar-token/index.ts` (linhas 87-98) contém:

```text
storageCard: "2"
brandTid: cartao.token_rede
expirationMonth: String(cartao.expiration_month).padStart(2, "0")
expirationYear: normalizado para 4 dígitos
cardholderName: holder_name em maiúsculas, sem acentos
```

A correção está no arquivo. Deploy da função ocorre a cada alteração, então a próxima chamada usa esta versão.

## Sobre a suspeita de cache

A função não tem cache de resposta. O que pode devolver um resultado repetido é a **checagem de idempotência em `pagamentos_rede`**: se já existe um registro para o mesmo `venda_id`/tentativa, a função pode retornar a resposta anterior sem chamar a Rede. É a explicação mais provável para "mesma resposta de antes" — não confirmei ainda qual chave de idempotência foi gravada na tentativa das 13:29.

## O que proponho fazer (requer sua aprovação, é cobrança real)

1. Ler as linhas de `pagamentos_rede` referentes ao `venda_id` `1824916f...` para saber se a idempotência vai bloquear/reaproveitar a tentativa.
2. Se houver bloqueio, informar você e sugerir a saída (novo `venda_id` de teste ou ajuste de chave) antes de qualquer cobrança.
3. Se não houver bloqueio, invocar `rede-cobrar-token` via POST com o payload informado (`amount` 1.00, `installments` 1) — cobrança real de R$ 1,00 no cartão salvo.
4. Retornar status HTTP e corpo completos, e buscar os logs da função filtrando pelo horário da invocação nova.

Nenhum código será alterado nesta etapa.
