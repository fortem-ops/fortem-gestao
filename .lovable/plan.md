# "Alterar dados da venda": editar também parcelas já pagas

## O que muda
Na janela "Alterar dados da venda" (perfil do aluno → Contrato), as parcelas **Pagas** deixam de ficar travadas: dá para mudar vencimento e valor delas também.

- Parcela paga continua **Paga**. Ela não volta para Pendente/Atrasado e não entra em inadimplência.
- Parcelas em aberto seguem como hoje: o status é recalculado pela data.
- Canceladas continuam travadas.
- Quando alguma parcela paga for alterada, aparece um aviso e um campo de **motivo**, que é obrigatório. A alteração corrige só o registro: nada é cobrado nem estornado no cartão ou no Pix.
- Só coordenação e admin podem editar parcelas pagas. Para os demais, elas continuam travadas.
- O texto da janela passa a ser "Edite vencimento e valor das cobranças deste contrato."

## Detalhes técnicos
- `AlterarDadosVendaDialog.tsx`: `editavel` passa a aceitar `pago` quando `useUserRoles` indicar coordenação/admin. No salvar, as linhas pagas atualizam só `data_vencimento` e `valor`, sem `status` e sem mexer em `inadimplencias`. O motivo é obrigatório se alguma linha paga mudar.
- O motivo é gravado em `audit_log` (operação `update`, tabela `cobrancas`) por uma pequena função no banco, `fn_registrar_motivo_edicao_cobranca`, que exige coordenação/admin. A alteração em si já entra no histórico pelos registros automáticos existentes.
- Antes de concluir, conferir que a sincronização automática de Receitas acompanha o novo valor da parcela paga, sem duplicar. Se não acompanhar, avisar.
- Nada de Planos 1/2, flags ou recorrência.
