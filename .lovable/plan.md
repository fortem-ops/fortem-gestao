# Fase 3 — Cobrança automática: relatório de investigação e recomendação

## 1. renovar-planos-mensais: venda e cobrança são paralelas, sem vínculo

A function não cria cobrança. Ela apenas:
- busca `planos` com `ativo=true`, `renovacao_automatica=true`, `proxima_renovacao <= hoje`;
- trava idempotência (nenhuma venda `origem='renovacao_automatica'` do mesmo aluno nas últimas 20h);
- desativa o plano antigo;
- insere uma `vendas` pendente (`origem='renovacao_automatica'`), e é o trigger `fn_processar_venda` que cria plano + contrato + cobrança.

O insert só devolve `plano_id`. Nenhum campo de ligação venda↔cobrança é gravado depois. Confirmado nos dados: apenas **22 de 236 vendas** dos últimos 120 dias têm `vendas.cobranca_id` preenchido. Na prática, venda e cobrança são objetos paralelos ligados só indiretamente pelo `plano_id`.

## 2. contratos NÃO tem venda_id

As colunas de referência de `contratos` são `plano_id`, `aluno_id`, `cartao_token_id`. Não existe qualquer coluna apontando para a venda de origem.

## 3. resolverVendaIds aplicado a cobranças de recorrência: NÃO é confiável

Rodei a mesma lógica (direto por `vendas.cobranca_id`; fallback `cobrancas → contrato_id → contratos.plano_id → vendas por aluno_id+plano_id`) sobre **todas as 448 cobranças pendentes/atrasadas de contratos `cartao_recorrencia`**:

| Resultado | Qtd |
|---|---|
| Nenhuma venda encontrada (resolução vazia) | 330 (74%) |
| Exatamente 1 venda encontrada | 118 |
| Mais de 1 venda (ambíguo) | 0 |
| Vínculo direto por `vendas.cobranca_id` | 0 nas amostras |
| Das 118: venda já em status ≠ pendente | 27 |
| Das 118: `valor_final` da venda ≠ `cobrancas.valor` | 31 |

Exemplos concretos das 5 primeiras: 2 sem venda alguma; 1 com venda já `pago` (cobrança continua `atrasado`); 2 com venda pendente e valor batendo.

Agravante estrutural: **356 dessas cobranças pertencem a contratos com mais de uma cobrança** (114 contratos têm N cobranças). Como a resolução chega no máximo até o `plano_id` do contrato, ela é **1 venda para N cobranças** — não existe informação para dizer *qual ciclo/parcela* aquela cobrança representa. Mesmo nos 118 casos em que "encontra 1 venda", essa venda é a venda do contrato inteiro, não a do ciclo.

## 4. Reaproveitar rede-cobrar-token direto no cron: inviável como está

Obstáculos concretos, todos observados no código/dados:

1. **Resolução de venda falha em 74% dos casos** — o cron simplesmente não teria `venda_id` para chamar.
2. **Idempotência errada de granularidade** — `rede-cobrar-token` deduplica por `pagamentos_rede.venda_id` com status `approved|pending`. Com 1 venda para N cobranças mensais, a segunda mensalidade seria bloqueada como "idempotente" e nunca cobrada.
3. **Efeitos colaterais em nível de venda** — a function faz `vendas.status_pagamento = pago|falha` e baixa **todas** as `pagamento_parcelas` pendentes do pagamento da venda. Numa cobrança de um único ciclo isso quita parcelas que não foram pagas.
4. **Valor divergente** em 31 casos: a venda não é a fonte de verdade do valor do ciclo; a cobrança é.
5. **A cobrança não é marcada como paga** — `rede-cobrar-token` não conhece `cobrancas`, então o ciclo continuaria `atrasado` mesmo após aprovação.

## Recomendação: function nova, reaproveitando o núcleo por refatoração

Criar `cobrar-recorrencias-diario` **orientada a cobrança**, não a venda:

- Entrada: `cobrancas` com `status in ('pendente','atrasado')`, `data_vencimento <= hoje`, cujo contrato seja `ativo` + `cartao_recorrencia` + `cartao_token_id not null` (o campo que a Fase 2 passou a preencher).
- Valor: sempre `cobrancas.valor`. Cartão: sempre `contratos.cartao_token_id`.
- Idempotência por **cobrança**, não por venda: `pagamentos_rede` precisa de `cobranca_id` (nova coluna nullable + índice único parcial em `(cobranca_id)` para status `approved|pending`), mais uma tabela/trava de tentativas com limite de retentativas por cobrança.
- Extrair o núcleo de `rede-cobrar-token` (criptograma MIT + POST `/transactions` + `mapReturnCode` + desativação de cartão em returnCode 54) para `_shared/`, e ter dois consumidores finos: o endpoint atual (efeitos em venda) e o cron (efeitos em cobrança). Isso reaproveita 100% da lógica Rede já testada sem herdar os efeitos colaterais de venda.
- Pós-aprovação no cron: baixar a `cobranca` para `pago` e, opcionalmente, propagar para a venda usando a lógica existente de `baixaVenda` **apenas quando a resolução for única e o valor bater** — nunca como caminho obrigatório.
- Agendamento: `pg_cron` diário via `net.http_post` com `x-webhook-secret`, no mesmo padrão de `renovar-planos-mensais`.

## Antes de implementar

Vale decidir dois pontos: (a) se as 330 cobranças sem venda resolvível devem ser cobradas mesmo assim (na arquitetura acima, sim — a cobrança basta); (b) política de retentativa (quantas tentativas, intervalo, e o que fazer no returnCode 54 além de desativar o cartão).

## O que NÃO foi alterado

Nenhum arquivo de código foi modificado nesta investigação.
