# Corrigir erro ao cadastrar voucher da festa

## Causa (confirmada no banco)
Os vouchers novos dão desconto em valor por pessoa e gravam o desconto percentual como 0. Uma regra antiga da tabela exige percentual entre 1 e 100, então todo cadastro novo é recusado.

## Correção
- Ajustar essa regra para aceitar percentual de 0 a 100. Nada mais muda: o voucher Equipe10 (100%) continua igual e o limite de R$ 0,01 a R$ 75,00 por pessoa segue valendo.
- Depois, cadastrar um voucher de teste dentro de uma transação desfeita para confirmar que passa, sem deixar registro.

## Detalhes técnicos
Migração: `DROP CONSTRAINT festa_vouchers_desconto_pct_check` e recriar com `CHECK (desconto_pct >= 0 AND desconto_pct <= 100)`. Sem mudar código, `fn_festa_voucher_criar` ou o cálculo do valor.
