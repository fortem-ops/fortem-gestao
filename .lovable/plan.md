# Saídas do Inter já conciliadas manualmente aparecendo como pendentes

## O que foi encontrado
- A saída EDP de R$ 743,50 em 26/10 (extrato "PAGAMENTO DE TITULO - ASSOCIACAO RSL1") já tem despesa: EDP ENERGIAS DO BRASIL, vencimento 25/10, pago em 26/10, marcada como conciliada.
- Essa despesa foi marcada como conciliada à mão, mas sem ligação com a linha do extrato. A rotina diária só procura despesas **não conciliadas**, então ignora essa e gera o aviso.
- O nome no extrato do boleto (ASSOCIACAO RSL1) não tem "EDP", por isso a busca por nome também não encontra.
- Das 14 saídas pendentes hoje, 7 têm uma despesa paga, já conciliada, mesmo valor e data até 3 dias de diferença — mesmo caso da EDP.

## O que será feito
1. **Rotina diária**: antes de avisar, procurar também despesas pagas e já conciliadas sem ligação com o extrato, mesmo valor exato, data de pagamento ou vencimento até 3 dias úteis de diferença (cobre vencimento em fim de semana/feriado). Se houver uma só, ligar automaticamente sem alterar a despesa. Se houver mais de uma, não ligar e manter o aviso.
2. **Janela de datas**: busca comparando com vencimento e pagamento, em ±3 dias corridos estendidos para o próximo dia útil (fim de semana).
3. **Quadro "Saídas do Inter sem despesa"**: ao abrir "Associar a conta", mostrar primeiro essas despesas já conciliadas sem ligação, com a etiqueta "Conciliada manualmente". Associar apenas cria a ligação, sem mudar valor.
4. **Limpeza das pendentes atuais**: aplicar a mesma regra às 14 saídas abertas uma vez; as que tiverem uma só correspondência (esperadas ~7, incluindo a EDP) saem da lista e o aviso é dado como resolvido. Sem apagar nada.
5. Testes da regra de datas (sábado/domingo → próximo dia útil) e do caso "mais de uma correspondência não liga".

## Detalhes técnicos
- `conciliar-extrato-diario`: nova etapa após `baixarPendente` → `vincularConciliadaManual` (despesas `conciliado=true`, sem linha ativa em `conciliacoes_bancarias`, `valor` igual, `data_pagamento`/`data_competencia` na janela), insere vínculo `tipo_match='manual_previo'`, `confianca='aproximada'` quando datas diferem; marca `conciliacao_avisos.resolvido_em`.
- Diálogo de conciliação: incluir candidatos conciliados sem vínculo; RPC existente usada só para vínculo, sem ajuste de valor quando iguais.
- Backfill pontual via chamada da função (não migração); rollback = marcar vínculos `manual_previo` como `desfeito` e reabrir avisos.
- Sem mudanças nas regras de despesas, valores ou outras rotinas.
