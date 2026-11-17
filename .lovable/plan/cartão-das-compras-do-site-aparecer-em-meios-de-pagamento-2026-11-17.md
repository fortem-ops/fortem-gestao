# Cartão das compras do site aparecer em Meios de Pagamento

## O que encontrei (somente leitura)
- Não é só a Edna. As 4 compras com cartão feitas pelo site de planos (/planos) estão sem cartão em Meios de Pagamento:
  - Edna Weisheimer — 12x no cartão (19/10)
  - Letícia Cunha da Rosa — 12x no cartão (22/10)
  - Manuele Montanari Araldi — recorrência mensal
  - Camila Boff — recorrência mensal
- Não é uma falha de ativação: o site foi feito assim. O cartão fica guardado com segurança na compra (as 4 têm o cartão ativo na Rede), mas ligado à proposta, e nunca é copiado para o cadastro do aluno. As vendas feitas pela recepção, pelo portal e pelo link de cadastro continuam salvando o cartão normalmente.
- A cobrança mensal de Manuele e Camila não é afetada: ela usa o cartão da própria proposta, como manda a regra da recorrência 2027.

## O que proponho
1. Ao ativar uma compra do site, copiar o cartão que já está guardado para Meios de Pagamento do aluno (bandeira, final, validade), com a origem "site de planos".
2. Fazer a mesma cópia agora, uma vez, para as 4 alunas acima.
3. Não mudar nada na cobrança: a recorrência 2027 continua cobrando só pelo cartão da proposta, e o cartão salvo não entra em nenhuma cobrança automática antiga, que segue desligada.
4. Não cobrar nada e não chamar a Rede: só aproveitar o cartão que já existe.

## Decisão confirmada
- O cartão copiado vira "principal" só se o aluno não tiver outro cartão ativo.

## Detalhes técnicos
- Hoje `planos-token.ts` e `fn_checkout_2027_ativar*` não criam `cartoes_salvos`; `rede_tokenizacoes.aluno_id` fica nulo.
- A mudança fica na ativação (`fn_checkout_2027_ativar` / `_ativar_admin` / `_ativar_seguro`): insere em `cartoes_salvos` (nova origem `planos_site` liberada na regra de origens de `cartoes_salvos`) a partir do token ativo da tentativa aprovada, idempotente pelo `token_rede`, e grava `rede_tokenizacoes.aluno_id` e `cartao_salvo_id`.
- Correção das 4 alunas feita depois, pelas ferramentas de dados (não na migração).
- `fn_recorrencia_2027_*` continuam exigindo o token da proposta, sem mudança.
- Testes: ativação cria um cartão salvo; ativar de novo não duplica; recorrência continua usando o token da proposta; cartão simulado nunca é copiado.
