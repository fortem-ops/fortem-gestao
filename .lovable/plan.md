# Corrigir erro ao lançar fatura do C6 Bank

## Causa (confirmada)
O cadastro do cartão "C6 Bank" usa a conta "C6 BANK", mas a tabela de despesas só aceita as contas "BANCO INTER" e "ITAÚ". Por isso toda linha da fatura do C6 é recusada ao lançar.

## O que fazer
1. Liberar a conta "C6 BANK" nas despesas (recriar a regra de contas aceitas incluindo BANCO INTER, ITAÚ e C6 BANK).
2. Adicionar "C6 Bank" na lista de contas do app (filtros de Despesas, formulário de nova/editar despesa e cadastro rápido de cartão), para que lançamentos do C6 apareçam e possam ser filtrados.
3. Nenhum lançamento existente é alterado.

## Detalhes técnicos
- Migração: `ALTER TABLE despesas DROP CONSTRAINT despesas_conta_bancaria_check; ADD CONSTRAINT ... CHECK (conta_bancaria IS NULL OR conta_bancaria IN ('BANCO INTER','ITAÚ','C6 BANK'))`.
- `src/types/despesas.ts`: `DespesaConta` e a lista de opções ganham `'C6 BANK'` / "C6 Bank".
- Verificar com type-check e conferir a regra nova no banco.
