# Saídas do Inter: associar a várias despesas e descartar saída

## O que muda para você

1. **Associar a mais de uma despesa (soma)**
   - Na janela "Associar a conta", cada despesa ganha uma caixa de seleção.
   - Um rodapé mostra: valor da saída, soma selecionada e diferença.
   - O botão "Associar" só libera quando a soma bate com a saída (tolerância de R$ 0,01). Nesse modo nenhum valor de despesa é alterado — serve para faturas de cartão (Inter, C6) cujas compras já foram lançadas.
   - A associação de uma única despesa continua como hoje (com ajuste de valor, se diferente).
   - A lista passa a incluir despesas já pagas/lançadas com cartão de crédito do período, para que os itens da fatura possam ser escolhidos, com busca por texto.

2. **Descartar saída (não é despesa)**
   - Novo botão "Não é despesa" em cada saída do quadro.
   - Pede um motivo curto (ex.: "Estorno de entrada de teste"). Some do quadro e a notificação é marcada como resolvida.
   - Nada é apagado do extrato; o descarte pode ser desfeito na tela de Conciliação Bancária.
   - Primeiro uso: a devolução Pix de NICOLAS SQUEFF JANOVIK.

3. A rotina diária passa a ignorar saídas descartadas ou ligadas a várias despesas (não cria aviso de novo).

## Detalhes técnicos

- Hoje há uma ligação ativa por saída (`idx_conciliacoes_movimento_ativo`). Mantém-se isso: a ligação múltipla grava uma linha em `conciliacoes_bancarias` com `tabela_origem='despesas_multiplas'` e os itens em nova tabela `conciliacao_saida_itens (conciliacao_id, despesa_id, valor)` com GRANT/RLS de leitura staff.
- Descarte grava linha com `tabela_origem='ignorado'`, `registro_id` = id do movimento e motivo em nova coluna nullable `motivo`.
- Novas RPCs (admin/coordenador ativo via `fn_conciliacao_pode_editar`, revogadas de anon): `fn_conciliar_saida_multiplas(movimento, despesa_ids[])` valida soma no servidor, marca despesas como conciliadas sem mexer em valor/status; `fn_ignorar_saida(movimento, motivo)`. `fn_desfazer_conciliacao_saida` é estendida para os dois tipos (desmarca itens; não restaura valores, pois não mudaram).
- Despesas já `conciliado=true` não podem entrar em outra soma.
- Front: `ConciliarSaidaDialog.tsx` (seleção múltipla), `SaidasSemDespesaCard.tsx` (botão descartar), `ConciliacaoBancaria.tsx` (exibir/desfazer). Edge `conciliar-extrato-diario` já trata qualquer ligação ativa como resolvida — conferir e republicar se precisar.
- Ensaio revertido no banco: soma correta liga, soma divergente rejeita, descarte e desfazer. Atualizar AGENTS.md (regra de conciliação de saídas).
