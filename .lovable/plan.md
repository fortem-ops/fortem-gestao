# Previsibilidade: nova data das parcelas de cartão e conferência de vendas faltando

## Regra da data (confirmada pelo dono)
- Cada parcela cai no **mesmo dia da venda, nos meses seguintes, mais 1 dia**.
- Se cair em fim de semana ou feriado, passa para o próximo dia útil.
- Exemplo do Matheus (venda em 16/10/2026): 1ª em 17/11/2026, 2ª em 17/12/2026 ... 12ª em 17/10/2027 (domingo), que passa para **18/10/2027**.
- Em meses mais curtos (venda no dia 31, por exemplo), usa-se o último dia do mês e depois soma-se 1 dia.

## Conferência de vendas faltando
1. Listar todas as vendas pagas no cartão parcelado ou em 12x no cartão cujas parcelas futuras não aparecem na previsão. Hoje entram só vendas cujas parcelas estão como "Pago" e que têm contrato ligado.
2. Investigar os casos que ficaram de fora: parcelas ainda "Pendente" numa venda paga, venda sem contrato, forma de pagamento escrita de outro jeito ou falta da data da venda.
3. Mostrar a lista ao dono (aluno, valor, nº de parcelas, motivo) antes de qualquer ajuste nos dados. Os dados só são alterados depois que ele aprovar.

## Detalhes técnicos
- Em `vw_recebiveis_previstos_cartao_parcelado`, trocar `data_venda + n*30` por `fn_fin_proximo_dia_util((data_venda + n * interval '1 month')::date + 1)`.
- As funções `fn_previsibilidade_*` leem as views e não precisam mudar.
- Atualizar o rollback para guardar a definição atual da view.
- Teste: uma venda em 16/10/2026, 12x, tem a 1ª parcela em 17/11/2026 e a 12ª em 18/10/2027.
- Não altera cobranças, vendas, flags nem os Planos 1 e 2.
