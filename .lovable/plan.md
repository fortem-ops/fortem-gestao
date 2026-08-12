# Cadastro de cartão: transação aprovada, tokenização sem token

## O que os logs mostram (12/08, 09:41 SP / 12:41 UTC)

A função de cadastro de cartão é a `rede-salvar-cartao`. Sequência exata do que aconteceu:

```text
12:41:51  OAuth Rede OK (token novo, 1439s)
12:41:52  POST /transactions -> HTTP 200, returnCode 00  (R$ 0,01 APROVADO)
12:41:53  ERRO: "tokenização falhou. Chaves: reference, tid, nsu,
          authorizationCode, brandTid, dateTime, amount, cardBin,
          last4, transactionLinkId, returnCode, returnMessage, links"
```

Não há stack trace: não foi uma exceção. A função retornou HTTP 500 de propósito, no ponto em que procura o token do cartão na resposta da Rede e não encontra nenhum dos campos esperados (`cardToken`, `cardStorage.cardId`, `storageCard.cardId`, `tokenId`). O frontend só recebe o genérico "Edge Function returned a non-2xx status code".

Causa: a Rede aprovou a transação mas **não devolveu token de cartão**. O pedido é enviado com `storageCard: 1` no corpo da transação — a resposta de produção não traz nenhum campo de token, o que indica que a tokenização não está habilitada para o PV 96337443 e/ou que o campo/fluxo correto para tokenizar na v2 é outro. Isso precisa ser confirmado antes de qualquer correção de código.

## Estado no banco

- `cartoes_salvos`: **nenhum registro** (tabela vazia) — o cartão do Nicolas não foi salvo.
- `pagamentos_rede`: nenhum lançamento nas últimas 2 horas.
- Nada ficou meio-gravado; o insert nunca chegou a rodar.

## Sobre o R$ 0,01

A transação foi criada com `capture: false` (pré-autorização) e a função dispara `DELETE /transactions/{tid}` logo após a aprovação — antes de falhar. Porém esse cancelamento **não é logado em caso de resposta não-2xx**, só em caso de exceção de rede. Ou seja: pelos logs atuais **não dá para afirmar que o estorno foi confirmado pela Rede**.

Ponto importante: por ser pré-autorização não capturada, o valor não vira cobrança efetiva — cai sozinho no emissor em alguns dias. A notificação do C6 é da pré-autorização, não de uma compra liquidada.

## Próximos passos propostos (nenhum código alterado ainda)

1. **Confirmar o estorno do R$ 0,01** — consultar na Rede o `tid` dessa transação e verificar se está cancelada/expirada. Requer o `tid`, que hoje não é registrado quando a tokenização falha.
2. **Confirmar com a Rede** se o PV 96337443 tem o serviço de tokenização (cartão salvo / storageCard) habilitado em produção e qual o payload/endpoint correto na v2. Esse é o bloqueio real — sem isso, qualquer ajuste de código é chute.
3. **Melhorias de robustez** a aplicar depois (fora do escopo desta investigação):
   - Logar o `tid` e o corpo completo (sem PAN/CVV) quando a tokenização falhar, para permitir rastrear/estornar.
   - Logar o status HTTP do `DELETE` de cancelamento.
   - Registrar a tentativa em `pagamentos_rede` mesmo quando falha, para trilha de auditoria.
   - Mensagem de erro específica no frontend em vez do genérico não-2xx.

Nada foi alterado no código ou no banco.
