# Venda de Gympass/Wellhub e Total Pass: início no dia 1 e sem cobrança

## O que muda na tela de venda
Quando o plano escolhido for **Gympass/Wellhub** ou **Total Pass**:

1. **Data de início** passa a ser sempre o **dia 1 do mês atual** (hoje, 28/09 → 01/09/2026). O campo mostra essa data travada, com o aviso: "Plano de plataforma: renova todo dia 1".
2. **Tipo de cobrança, desconto e etapa de Pagamento somem.** No lugar aparece um resumo simples: "Sem cobrança ao aluno — a plataforma paga depois. Valor: R$ 0,00".
3. O botão vira **"Concluir adesão"** e grava a adesão direto, com valor R$ 0,00 e status "pago" (não gera cobrança, pendência ou inadimplência).

Os demais planos continuam exatamente como hoje.

## Detalhes técnicos
- `VendaDialog.tsx`: `isAgregadora = /gympass|wellhub|total ?pass/i` no nome do plano selecionado.
- Efeito: se `isAgregadora`, `setDataInicio(new Date(ano, mês, 1))` (sobrepõe o efeito de modo de contrato); calendário desabilitado.
- Passo 4: esconder `TipoCobrancaSection` e o aviso de recorrência; botão chama `venderPlano` direto (sem passo 5).
- `venderPlano`: ramo agregadora usa `tipoCobranca="tradicional"`, `modalidade="dinheiro"`, canal `manual`, valor/desconto/valor_final = 0, taxa 0, `initialStatus="pago"`, parcelas 1. Segue criando contrato via `fn_criar_contrato_tradicional` (valor 0, pago) e atualizando o registro de plano com `renovacao_automatica=true` (renovação mensal dia 1, já reconhecida por `isAutoRenewPlan`).
- Sem alterações no banco.
