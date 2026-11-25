# Corrigir "Forma de recebimento inválida para venda já paga" (Corrida)

## Causa (confirmada no código)
Na venda retroativa da Corrida com pagamento já recebido em cartão na máquina, a tela envia `cartao_debito_maquina` / `cartao_credito_maquina`, mas o banco só aceita `maquina_debito` / `maquina_credito` (mesmos nomes usados na baixa manual). Por isso, pagamentos em débito ou crédito na máquina são recusados. Também, os campos de Bandeira e Parcelas não aparecem, pelo mesmo motivo.

## Correção
- `src/components/student/venda/VendaDialog.tsx`: trocar o mapeamento `formaRecRetro` para `maquina_debito` e `maquina_credito` (Dinheiro, Pix e Boleto continuam iguais).
- Nenhuma mudança no banco, nos planos 2027 (já usam os nomes certos) nem em outras telas.

## Teste de regressão
- Extrair o mapeamento para uma função pequena e testável (`formaRecebimentoDaModalidade`) em `src/lib/formasRecebimento.ts`. Em `src/test/vendaCorridaRetroativa.test.ts`, testar que débito → `maquina_debito`, crédito na máquina → `maquina_credito` e que todo valor retornado existe na lista aceita pelo banco (lida da migration `0298`). O teste falha antes e passa depois.
- Rodar `bunx vitest run` e `bunx eslint` nos arquivos alterados; testar no navegador uma venda retroativa de Corrida paga no débito.
