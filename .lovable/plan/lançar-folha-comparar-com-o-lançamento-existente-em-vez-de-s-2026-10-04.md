# Lançar Folha: comparar com o lançamento existente em vez de só bloquear

## Situação da Thaís
A folha de set/2026 dela já existe: "Salário + Férias Thaís dos Santos Bobroski (set/2026)", pendente, pagamento em 05/10/2026, **líquido a pagar R$ 843,26** (valor de categoria R$ 2.269,71). Por isso aparece "Já lançado". O valor que você espera já está gravado.

## O que muda
Quando já existir salário lançado para o funcionário naquele mês, o sistema compara os dados novos com os gravados: líquido, valor de categoria, data de pagamento e detalhamento.

- **Tudo igual:** mostra "Nada a atualizar: os valores são os mesmos já lançados para set/2026." Nada é gravado.
- **Algo diferente:** pergunta "Já existe um lançamento para set/2026. Líquido: R$ X → R$ Y (e outras diferenças). Deseja atualizar?"
  - **Atualizar:** o lançamento existente é atualizado. Não cria um segundo.
  - **Cancelar:** nada muda.
- **Já pago e conciliado, ou Pix já enviado ao Inter** (aguardando aprovação ou concluído): não deixa atualizar. Mostra o motivo, para não mudar um pagamento que já saiu.

Vale para o lançamento individual. No lote do Extrato, linhas iguais aparecem como "Sem alterações". Linhas diferentes aparecem como "Diferente do lançado" com um botão "Atualizar" na própria linha. "Lançar todos" nunca atualiza nada sozinho.

## Detalhes técnicos
- `FolhaForm.lancar()`: a checagem de duplicidade passa a buscar `id, valor, valor_liquido_previsto, valor_pago, data_competencia, observacao, status, conciliado, pix_status`. A função retorna um resultado com tipo `{ tipo: "igual" | "diferente", existente, diff }` em vez da string "Já lançado".
- Novo `lancar({ atualizarId })`: faz update por id com o mesmo payload, mantendo `created_by`/`origem`, e status/valor_pago pela regra de data futura.
- Bloqueio: `pix_status in (AGUARDANDO_APROVACAO, CONCLUIDO)` ou `conciliado = true`.
- Comparação com arredondamento a 2 casas. O AlertDialog de confirmação fica no individual. No `ExtratoLista`, o novo estado da linha recebe a ação Atualizar.
- Sem mudança de banco.
