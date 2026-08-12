# Configurar REDE_WEBHOOK_TOKEN

## Objetivo
Armazenar o secret `REDE_WEBHOOK_TOKEN` no projeto para que a Edge Function `rede-tokenizacao-webhook` possa validar o header `Authorization: Bearer <token>` enviado pela Rede.

## O que será feito
1. Usar `secrets--set_secret` para salvar `REDE_WEBHOOK_TOKEN` com o valor fornecido.
2. Usar `secrets--fetch_secrets` para listar os secrets configurados e confirmar que `REDE_WEBHOOK_TOKEN` aparece na lista (sem revelar valores de outros secrets).

## Nota
Este é um shared secret: o mesmo valor deve ser colado no portal da Rede ao configurar o webhook. O valor já foi fornecido pelo usuário, então será salvo diretamente via `set_secret`.
