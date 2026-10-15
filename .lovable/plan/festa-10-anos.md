# Festa 10 anos — /10anos (frente independente)

Os Planos 1 e 2 em `.lovable/plan.md` continuam pendentes e não foram tocados.

Etapas:
1. Configuração + página pública. Feito.
2. Banco, formulário e contador. Feito (migração 0143).
3. Tela da equipe. Feito.
4. PIX via Inter. Feito, usando as credenciais de cobrança da Loja/Corrida; aguarda o primeiro teste real.

Segurança:
- Visitantes sem login não leem nenhuma tabela da festa.
- O contador devolve só o número.
- O voucher fica guardado no servidor apenas como código embaralhado.
- O webhook já valida o token e só dá baixa se o valor bater, de forma idempotente.
- Existe uma consulta de segurança ao Inter durante o acompanhamento do pagamento.

Volta (rollback): ver `scripts/festa-10anos.rollback.sql`.
