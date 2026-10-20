# Desconto na venda de planos 2027 (painel da equipe)

## O que muda para a equipe
- No passo **Resumo/Pagamento** da "Nova Venda — Planos 2027" aparece o campo **Desconto (R$)** sobre o valor do plano (não sobre serviços complementares), limitado ao valor do plano, com motivo opcional em Observações.
- O resumo de parcelas (Plano / Serviços / Total) já mostra o valor com desconto.
- **Somente no Start (recorrência mensal)**, ao informar desconto, aparece a pergunta obrigatória:
  - "Aplicar este desconto também nas mensalidades seguintes?"
    - **Só no 1º mês** — renovações voltam ao preço cheio.
    - **Em todos os meses** — cada renovação mantém o mesmo desconto até o cancelamento.
  - Sem escolha, o botão "Registrar venda 2027" fica bloqueado.
- Power/Pro (anual, 12x ou Pix): desconto aplicado uma vez sobre o total, dividido nas parcelas (sobra de centavos na última).

## O que não muda
- Planos atuais (legado), site `/planos`, checkout, recorrência automática, crons, flags e vendas já registradas.
- Serviços complementares continuam sem desconto.

## Detalhes técnicos
- `src/lib/vendas2027.ts`: `calcularVenda2027` recebe `descontoPlano` (centavos, 0..valor do plano); testes novos: Start com desconto, Power 12x com desconto e sobra na última parcela, desconto maior que o plano rejeitado.
- `Venda2027Steps.tsx`: campo de desconto + pergunta do Start; envia `p_desconto` e `p_desconto_recorrente` para `fn_venda_2027_criar`.
- Migration nova (aditiva): `fn_venda_2027_criar` aceita os dois parâmetros com DEFAULT (0 / false), valida no servidor, grava `vendas.desconto`/`valor_final`, contrato `valor_cobrado` e 1ª cobrança com desconto. Coluna nova `planos.desconto_recorrente numeric DEFAULT 0`.
- `fn_renovar_start_2027`: ao gerar o próximo ciclo, usa `valor - desconto_recorrente` (venda, contrato, cobrança) e copia o desconto para o novo plano; quando 0, comportamento idêntico ao atual. Bloco legado de `renovar-planos-mensais` intocado.
- Teste da renovação em transação com rollback usando NICOLAS TESTE; nenhuma venda real criada.
