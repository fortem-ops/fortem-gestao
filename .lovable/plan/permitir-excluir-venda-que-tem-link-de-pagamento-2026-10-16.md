# Permitir excluir venda que tem link de pagamento

## Causa (confirmada)
Ao excluir a venda 5999fb97, o banco recusa: existe um link de pagamento (criado hoje 14:55, não usado, expira 23/10) ligado a ela. A limpeza automática da venda apaga contratos, cobranças, créditos e pagamentos, mas não apaga links de pagamento.

## O que muda
Ao excluir uma venda, os links de pagamento dela também são apagados (o link deixa de funcionar). Nada mais muda: cobranças pagas, Rede, Pix, flags e Planos 1 e 2 intocados.

Mesma regra para os outros vínculos que travariam da mesma forma: inscrições da corrida e cobranças Pix da corrida ficam com a venda desvinculada (não apagadas), para preservar o histórico.

## Detalhes técnicos
- Migração alterando só `fn_cleanup_on_venda_delete`: adicionar `DELETE FROM public.links_pagamento WHERE venda_id = OLD.id;` e `UPDATE corrida_inscricoes_prova / pix_cobrancas SET venda_id = NULL WHERE venda_id = OLD.id;` (se a coluna aceitar nulo; senão, só o link).
- Sem mudar grants, owner ou search_path.
- Verificação: a venda 5999fb97 passa a poder ser excluída pela tela.
