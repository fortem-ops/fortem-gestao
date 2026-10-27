# Aba "Voucher's" em Confirmações da Festa

## O que existe hoje
- Já há um voucher cadastrado (Equipe10), que só isenta 100% do valor. O site /10anos só aceita esse tipo e o mostra como "Valores isentos".
- O total é sempre recalculado no servidor (R$ 75 por pessoa). O navegador nunca define o valor.

## O que será feito
1. **Nova aba "Voucher's"**, ao lado de "Confirmações" e "Fotos da história":
   - Lista dos vouchers com descrição, desconto, quantas vezes foi usado e se está ativo.
   - Botão **Novo voucher**: código (ex.: AMIGO20), descrição e **desconto em R$ por pessoa**.
   - Ligar ou desligar cada voucher. Não há limite de usos.
   - O código fica guardado só de forma protegida. Depois de salvo, aparece apenas na hora da criação, como acontece hoje.
2. **No site /10anos:** ao aplicar o voucher, mostra "Desconto de R$ X por pessoa" e o total já com o desconto (ex.: 3 pessoas com R$ 20 de desconto = R$ 165,00). O Pix é gerado com esse valor.
   - O desconto nunca deixa o valor por pessoa abaixo de R$ 0. Se o total ficar R$ 0, a confirmação entra como isenta.
3. **Equipe10 continua igual**, isentando todos.
4. Confirmações já feitas mantêm o valor que tinham.

## Detalhes técnicos
- Migração aditiva em `festa_vouchers`: `desconto_centavos_pessoa integer null` e `codigo_exibicao text null` (só para os novos vouchers). Também: grants e RLS para gerentes (`is_coordenador_ou_admin`) lerem e gravarem. A leitura pública continua só pela função `festa-confirmar`.
- `fn_festa_total_novo` ganha o parâmetro de desconto por pessoa. O trigger de inserção lê o desconto pelo `voucher_id` e recalcula o total. O mesmo vale para `_shared/festa-valor.ts` e `src/lib/festa10anos.ts` (`calcularTotalFesta`).
- `festa-confirmar`: `voucherValido` aceita `desconto_pct=100` ou `desconto_centavos_pessoa>0`. A ação `voucher` devolve o desconto. O status fica `isento` só quando o total é 0.
- O hash do código é gerado no servidor, com uma função restrita a gerentes.
- Testes: desconto por pessoa (3 pessoas, R$ 20 → 16500), desconto maior que o valor por pessoa → 0, Equipe10 → 0.
- Rollback em `scripts/festa-vouchers-valor.rollback.sql`. Nada publicado sem pedido.
