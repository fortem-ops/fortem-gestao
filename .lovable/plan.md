# Venda retroativa com valor ajustado

## Objetivo
Na Nova Venda de planos 2027 (ficha do aluno), permitir que o **admin** registre uma venda que já aconteceu: com data no passado, valor maior que o do catálogo e já marcada como paga na forma escolhida.

## O que muda na tela (só admin)
Nova seção recolhida **"Venda retroativa / ajuste de valor"** no passo de pagamento:
- **Valor do plano**: campo opcional "Valor cobrado" (pode ser maior que o do catálogo). Se preenchido, substitui o valor do catálogo; o resumo mostra "Catálogo R$ X → Cobrado R$ Y". Desconto continua funcionando como hoje (não se usa os dois juntos).
- **Data da venda**: calendário aceitando datas passadas. O início do plano acompanha essa data (editável como hoje).
- **Já pago?** Se marcado: escolher **forma** (Dinheiro, Pix, Cartão de débito (máquina), Cartão de crédito (máquina), Boleto) e **data do pagamento**. Débito pede **Bandeira**; crédito pede **Bandeira** e **Parcelas** — os mesmos campos da baixa manual, para o cálculo dos recebíveis no financeiro.
- **Motivo** obrigatório (fica no histórico/auditoria).

Quando "Já pago" está marcado, a venda nasce paga com as cobranças baixadas nas datas/forma informadas, plano e créditos liberados normalmente (não abre tela de cartão nem link). Sem a marcação, segue o fluxo atual de cobrança, só com o valor/data ajustados.

Professores e coordenadores continuam vendo a tela como hoje.

## Fora do escopo
- Plano Semestral e vendas do site (/planos) não mudam — o site nunca recebe esse ajuste.
- Recorrência mensal automática no cartão não pode ser retroativa paga (cobrança futura continua pelo cartão); para recorrência, o ajuste vale só para a 1ª cobrança/valor do contrato.

## Detalhes técnicos
- `Venda2027Steps.tsx`: novos estados (valorManual, retroativa, pago, forma, bandeira, parcelasMaquina, dataPagamento, motivo), reutilizando o componente de bandeira/parcelas da baixa manual.
- `src/lib/vendas2027.ts`: `calcularVenda2027` ganha `valorPlanoOverride` (centavos, sobra na última parcela) — continua sendo a única fonte de valores.
- Nova RPC `fn_venda_2027_criar_retroativa` (SECURITY DEFINER, só admin via `has_role`, sem `anon`): chama `fn_venda_2027_criar` intacta, depois em **um único UPDATE** ajusta valores das cobranças (não por laço, por causa do gatilho de receitas) e, se pago, faz a baixa usando o mesmo caminho da baixa manual (forma, bandeira, modalidade, data); grava `audit_log` com motivo e valor de catálogo vs. cobrado. Recalcula no servidor e recusa valor menor que o catálogo nesse campo (redução continua sendo desconto).
- `fn_venda_2027_gravar` e `fn_venda_2027_criar` não são alteradas.
- Testes: valor maior substitui o catálogo com centavos na última parcela; só admin; venda paga retroativa grava forma/bandeira/data; débito exige bandeira; recorrência não aceita "já pago" além da 1ª.
- Regra registrada em `src/components/planos/AGENTS.md`.
