# Venda paga em Histórico de Vendas deve quitar a cobrança

## O que foi confirmado
- Venda de 27/10/2026, R$ 1.080,00, cartão de crédito, status **Pago**.
- O contrato dela tem **uma única cobrança** de R$ 1.080,00 (ciclo 1, vencimento 27/10/2026), ainda **Pendente**. O 6x é parcelamento na maquininha, não 6 cobranças.
- **Causa:** a regra automática que quita as cobranças quando a venda fica paga só roda quando a venda tem modalidade definida (cartão parcelado, à vista etc.). Esta venda está com modalidade **"pendente"**, então nada aconteceu.

## O que será feito
1. **Acerto desta venda:** marcar como Pago a cobrança de 27/10/2026 (R$ 1.080,00), com data de pagamento 27/10/2026. Backup antes, com como desfazer.
2. **Regra ampliada:** quando a venda ficar Paga com modalidade "pendente", a cobrança passa a Pago **somente se** o contrato tiver uma única cobrança em aberto e com o mesmo valor da venda. Fora disso (mensalidades, recorrência), nada muda — como hoje.
3. Multas de cancelamento, cobranças canceladas e já pagas continuam intocadas. Voltar a venda para Pendente não desfaz nada.

## Detalhes técnicos
- Ajuste na função do trigger de `vendas` (criada no plano "baixa-venda-parcelada"): novo ramo para `modalidade_pagamento = 'pendente'` com `count(*)=1` cobranças `pendente/atrasado`, `numero_ciclo<>999`, e `valor = valor_final`. Log em `system_logs`.
- Não chama Inter nem Rede; idempotente.
- Rollback em `scripts/baixa-venda-unica.rollback.sql`.
- Teste: modalidade pendente + cobrança única de mesmo valor quita; valor diferente ou várias cobranças não muda.
