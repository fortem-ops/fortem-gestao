# Venda retroativa / ajuste de valor também na Corrida

## O que muda para a equipe
Na Nova Venda, ao escolher **Corrida**, administradores passam a ver a mesma seção recolhida **Venda retroativa / ajuste de valor** que já existe nos planos 2027:

- **Valor cobrado (R$)**: pode ser maior que o do catálogo. O resumo mostra "Catálogo R$ X → Cobrado R$ Y" e as parcelas são recalculadas (sobra de centavos na última). Para valor menor, continua o campo de desconto.
- **Data da venda**: aceita data passada; a data de início do plano acompanha (e segue editável).
- **Já pago**: forma de recebimento (Dinheiro, Pix, Débito na máquina, Crédito na máquina, Boleto), data do pagamento e, para cartão na máquina, bandeira e parcelas — usadas no cálculo dos recebíveis do financeiro.
- **Motivo**: obrigatório, registrado na auditoria.

Quem não é administrador continua vendo a Corrida exatamente como hoje. Créditos, plano adicional e contrato da Corrida seguem a mesma regra atual.

## Detalhes técnicos
- A Corrida é vendida pelo fluxo antigo (`VendaDialog` → `vendas` + `fn_criar_contrato_tradicional`), não pelo fluxo 2027. Reaproveitar a lógica pura de `src/lib/vendas2027.ts` (validação de valor acima do catálogo, rateio de parcelas, motivo obrigatório) e extrair a seção visual de `Venda2027Steps.tsx` para um componente compartilhado.
- Nova RPC `fn_criar_contrato_tradicional_retroativa` (SECURITY DEFINER, só admin via `has_role`, sem grant para `anon`): grava valor ajustado, `data_venda` passada, cobranças com `status=pago`, `data_pagamento`, forma, bandeira e parcelas na baixa, e linha em `audit_log` com o motivo. Cobranças gravadas num único comando (sem laço), por causa do gatilho de receitas.
- Fora do modo retroativo, a chamada atual permanece idêntica.
- Atualizar `src/components/planos/AGENTS.md` com a regra.
- Testes: valor acima do catálogo aceito só para admin; motivo obrigatório; parcelas somam o total com centavos na última; cobrança nasce paga com a data/forma/bandeira informadas; não-admin recusado na RPC; Corrida sem retroativa inalterada.
- Rodar `bunx vitest run` e `bunx eslint` nos arquivos alterados. Nada publicado.
