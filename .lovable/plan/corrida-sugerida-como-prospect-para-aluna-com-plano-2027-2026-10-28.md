# Corrida sugerida como Prospect para aluna com plano 2027

## Causa (já confirmada)
Na venda pela ficha da aluna, a opção Corrida escolhe a faixa de preço pelo contrato ativo. O contrato da Rafaela é do Start 2027 e está gravado como `start_2027`. A tela só reconhece `start`, `start_plus`, `power`, `pro` e `max`, então trata a aluna como se não tivesse plano. Aí ela sugere o primeiro item de Corrida sem plano exigido, que é o **Corrida - Prospect**.

## Correção
- Reconhecer os contratos 2027 (`start_2027`, `power_2027`, `pro_2027` e demais famílias com sufixo `_2027`) como o plano base correspondente (Start, Power, Pro).
- Com isso a Rafaela passa a receber a sugestão **Corrida - Start** e o aviso "Sugerido pelo plano ativo: Start".
- Quando não houver plano base, sugerir **Corrida - Sem Plano**, como o aviso já diz, e nunca Prospect.

## Detalhes técnicos
- Em `VendaDialog.tsx`, extrair para `src/lib/corridaPlanoBase.ts` duas funções:
  - `planoBaseDeContrato(plano_tipo)`: remove o sufixo `_2027`.
  - Escolha da variante: com plano base nulo, prefere o nome "Corrida - Sem Plano".
- Testes:
  - `start_2027` vira `start`.
  - `power_2027` vira `power`.
  - Sem plano base, a sugestão é Sem Plano e não Prospect.
- Somente a sugestão da tela muda; preços, cobrança, banco e a corrida pública (que já reconhece a aluna corretamente) não são alterados.
