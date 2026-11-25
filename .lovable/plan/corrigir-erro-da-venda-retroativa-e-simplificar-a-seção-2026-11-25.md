# Corrigir erro da venda retroativa e simplificar a seção

## Causa do erro (confirmada)
A venda retroativa de Corrida falhou ao gravar o registro de auditoria: o banco só aceita uma lista fixa de tipos de operação, e "venda_retroativa" não está nela. Toda a venda é desfeita. O mesmo vale para a venda retroativa dos planos 2027, que usa o mesmo registro.

## O que muda
1. **Banco:** incluir "venda_retroativa" na lista de operações aceitas na auditoria (sem remover nenhuma existente).
2. **Seção "Venda retroativa / ajuste de valor"** (Corrida e planos 2027): fica só com **Valor cobrado**, **Data da venda** e **Motivo**. Saem dali "Já pago", forma de recebimento, bandeira, parcelas do cartão e data do pagamento.
3. **Etapa Pagamento:** passa a ser o único lugar para forma de pagamento, parcelas, situação (pago/pendente) e data. Quando a venda é retroativa e marcada como paga, a data do pagamento é pré-preenchida com a data da venda (editável), e a bandeira aparece ali para cartão na máquina, como já acontece na baixa manual.
4. O servidor continua recalculando valores, parcelas e a sobra de centavos; a regra "valor só acima do catálogo" e o motivo obrigatório ficam iguais.

## Testes
- Regressão: a lista de operações da auditoria aceita "venda_retroativa" (falha antes, passa depois).
- A seção retroativa não envia mais forma/bandeira próprias; o envio usa o que foi escolhido na etapa Pagamento.
- Rodar `bunx vitest run` e eslint nos arquivos alterados; refazer no navegador uma venda retroativa de Corrida.

## Detalhes técnicos
- Migration: recria `audit_log_operacao_check` com a lista atual + `'venda_retroativa'`.
- `VendaRetroativaSection.tsx`: remove props de pagamento.
- `VendaDialog.tsx` / `Venda2027Steps.tsx`: `ja_pago`, `forma_recebimento`, `bandeira`, `parcelas_cartao`, `data_pagamento` passam a vir do estado da etapa Pagamento (`PagamentoStep` / bloco "Pagamento do plano").
- As funções 0297/0298 não precisam mudar.
