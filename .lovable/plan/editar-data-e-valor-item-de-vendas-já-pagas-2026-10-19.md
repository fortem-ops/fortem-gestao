# Editar data e valor/item de vendas já pagas

## O que muda
Na janela "Editar pagamento" do Histórico de vendas (perfil do aluno), quem é coordenação/admin passa a poder alterar também:
- **Data da venda**
- **Item vendido**: escolher outro plano/serviço do catálogo (atualiza o nome mostrado)
- **Valor cheio** (o valor final é recalculado com o desconto, como hoje)

Isso vale para vendas pagas e também para as pendentes.

## Segurança (venda já paga)
- Para venda paga, aparece um aviso antes de salvar: a alteração **corrige só o registro da venda**. Nada é cobrado nem estornado no cartão/Pix. Também não mudam o contrato, as parcelas já lançadas em Cobranças, os créditos do aluno e a comissão.
- Se o novo valor for diferente da soma das parcelas já lançadas, o aviso mostra a diferença para a equipe ajustar à mão.
- É preciso escrever um motivo. Tudo fica registrado no histórico de auditoria (quem, quando, valores antes e depois).
- Vendas canceladas ou estornadas continuam sem edição desses campos.

## Detalhes técnicos
- Nova função no banco `fn_editar_venda_dados(p_venda_id, p_data_venda, p_catalogo_id, p_valor, p_motivo)`: SECURITY DEFINER, exige `is_coordinator_or_admin`, recusa venda cancelada/estornada e valida o item no catálogo do mesmo tipo. Atualiza `data_venda`, `catalogo_id`, `nome_snapshot`, `valor` e `valor_final = max(0, valor - desconto)`. Grava o motivo em `audit_log` (operação `update`) e não mexe em `status_pagamento`, então os gatilhos de cobrança e comissão não disparam.
- `HistoricoVendas.tsx`: campos novos na janela; salvar chama a função e depois atualiza desconto/forma/parcelas/status como hoje; o aviso compara com a soma das parcelas do contrato da venda.
- Teste da regra do valor final e da recusa para vendas canceladas.
- Validar numa venda de teste (NICOLAS TESTE), sem cobrança real; nada de Planos 1/2, flags ou recorrência.
