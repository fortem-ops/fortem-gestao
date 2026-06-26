## Objetivo

Em **Perfil do Aluno → Plano/Serviços**, replicar o comportamento da aba **Pagamentos**: listar **todos os planos contratados ativos** (não apenas o vigente). Renovações e contratos adicionais com `data_inicio > hoje` aparecem logo abaixo do plano vigente com o badge **"Aguardando início"**.

## Estado atual

`src/components/student/StudentPlan.tsx` busca apenas **um** plano em `planos` (o vigente hoje, ou o mais recente como fallback). Renovações já vendidas com início futuro ficam invisíveis nessa aba até o dia em que entram em vigência.

## Mudanças

### 1. `src/components/student/StudentPlan.tsx`

- Trocar a query `plano_ativo` por **`planos_contratados`**: traz todos os registros de `planos` do aluno com `ativo = true`, ordenados por `data_inicio` ascendente. Para cada um, carrega `consumo_servicos` daquele `plano_id` e monta o objeto `credits` exatamente como hoje.
- Separar a lista em:
  - **Vigente** (`data_inicio <= hoje` e ainda não vencido) — o primeiro/único; renderizado com o card completo atual (edição, créditos, licenças, cancelar contrato, etc.).
  - **Aguardando início** (`data_inicio > hoje`) — renderizados abaixo, cada um em um card mais enxuto com: badge **"Aguardando início"** (status-warning), tipo, valor, início, término, duração e a linha de créditos do plano. Sem botões de edição/uso para não duplicar fluxos; mantém apenas "Cancelar contrato" para admin/coord (reusa `CancelContractDialog` passando o `plano` correspondente).
- Se não houver vigente mas existir futuro, o card de futuro é o único exibido (com aviso "Plano ainda não iniciou").
- Manter `StudentServicos` e `StudentLicencas` ligados ao plano **vigente** (comportamento atual). Para o futuro, apenas a faixa de créditos prevista do próprio plano.
- Atualizar `invalidatePlanoCaches` chamadas para a nova `queryKey` (adicionar `"planos_contratados"` em `src/lib/planoCache.ts`).

### 2. `src/lib/planoCache.ts`

- Acrescentar `qc.invalidateQueries({ queryKey: ["planos_contratados", alunoId] });` para que vendas/edições/cancelamentos refresquem a nova lista.

## Fora de escopo

- Nenhuma mudança em RPC, migrations, edge functions, `VendaDialog`, `ContratoFinanceiro` ou regras de negócio. A view de "Pagamentos" continua como referência visual — não é compartilhada.
