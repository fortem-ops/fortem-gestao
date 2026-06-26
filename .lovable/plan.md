## Diagnóstico

A duplicação de "Avaliação Funcional" no aluno (Marilza) tem duas causas combinadas:

1. **`criarCreditosServicos` (VendaDialog.tsx) insere o crédito de AF com `origem_id = NULL`.** Sem vínculo com a venda, esse crédito fica órfão e não é removido quando a venda é excluída.
2. **A exclusão de venda em `HistoricoVendas.tsx` só apaga `creditos_aluno` por `origem_id = venda.id`**, e nada apaga `contratos` / `ciclos_credito` / `cobrancas` ligados à venda. As tentativas anteriores da Marilza geraram 6 contratos `cancelado` e deixaram 1 crédito de AF preso (`origem_id` apontando para um contrato cancelado).

Resultado: a tabela "Serviços e Créditos Contratados" lê todos os créditos `ativo=true` do aluno e mostra 2 AF (1 órfão do contrato cancelado `3de3f031` + 1 da venda atual).

## O que será feito

### 1. Frontend — `src/components/student/venda/VendaDialog.tsx`
- Em `criarCreditosServicos`, gravar `origem_id = vendaId` para amarrar os créditos de serviço (AF / Nutrição / Reabilitação) à venda. Assinatura recebe o `vendaId` retornado pelo insert.
- Chamar `criarCreditosServicos(servicosInclusos, vendaIns.id)` no fluxo.

### 2. Frontend — `src/components/student/venda/HistoricoVendas.tsx`
Ampliar a exclusão da venda para um cleanup transacional na ordem:
1. Buscar contratos com `plano_id = venda.plano_id`.
2. Para cada contrato: `delete cobrancas where contrato_id=...`, `delete ciclos_credito where contrato_id=...`, `delete contratos where id=...`.
3. `delete creditos_aluno where origem_id = venda.id` (já existe — agora cobre AF/Nutri/Reab também, graças ao item 1).
4. `delete pagamentos_rede`, `delete comissionamentos`, `delete vendas` (mantém).
5. Se o `plano` vinculado ficar sem outras vendas/contratos ativos, marcar `ativo=false`.

### 3. Migração de limpeza (data-fix)
- Deletar `creditos_aluno` cujo `origem_tipo='plano'` e `origem_id` aponte para um contrato com `status='cancelado'` **ou** para uma venda inexistente.
- Deletar `ciclos_credito` e `cobrancas` de contratos `status='cancelado'`, depois deletar esses contratos.
- Desativar (`ativo=false`) registros em `planos` sem venda associada e sem contrato `ativo`.

Escopo conservador: filtrar pelo aluno `23f6ae86-...` primeiro para validar, depois aplicar ao universo. (O plano pode rodar global já que a regra é segura — só remove o que está marcado como cancelado/órfão.)

### 4. Verificação
Re-consultar `creditos_aluno` da Marilza e confirmar 2 linhas ativas: Treino (52) + Avaliação Funcional (1). UI deve refletir após `invalidateQueries`.

## Detalhes técnicos

- O trigger `fn_processar_venda` já está correto (cria só o crédito de Treino com `origem_id=venda.id`); não será alterado.
- A RPC `fn_criar_contrato_recorrencia` não toca `creditos_aluno`; não será alterada.
- Não há FK ON DELETE CASCADE de `creditos_aluno → vendas` (origem_id é polimórfico via `origem_tipo`), por isso a limpeza precisa ser explícita no app.
