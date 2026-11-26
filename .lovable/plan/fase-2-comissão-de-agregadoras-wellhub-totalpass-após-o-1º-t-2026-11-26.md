# Fase 2 — Comissão de agregadoras (Wellhub/TotalPass) após o 1º treino

## O que muda para a equipe
- Quando um prospect que fez treino experimental passa a treinar por Wellhub ou TotalPass, a comissão de conversão (R$ 30) do professor do experimental só nasce depois do **1º treino realizado** já como aluno de agregadora.
- Essa comissão não fica aprovada sozinha: entra como **"Aguardando aprovação"** na tela de Comissionamentos.
- O admin ganha um botão **"Aprovar"** (individual e em lote) nessas comissões; o botão "Dar baixa / Marcar pago" já existente segue igual depois da aprovação.
- Vendas diretas (plano, /planos, 2027) continuam como hoje: aprovadas automaticamente ao confirmar o pagamento.
- Cada aluno gera no máximo uma comissão de conversão (sem duplicar a cada check-in).

## Regras
- Só vale com treino experimental concluído antes (pendência "avaliar experimental" concluída).
- O "1º treino" é o primeiro treino concluído/presença confirmada com data igual ou posterior ao início do vínculo com a agregadora. Check-in facial sozinho não conta (porta não gera presença).
- Aluno inativo ou da equipe não gera comissão.
- Se o vínculo com a agregadora for desfeito antes da aprovação, a comissão pendente é cancelada.

## Detalhes técnicos
- Migration nova:
  - `fn_tentar_comissao_agregadora(_aluno)`: verifica experimental concluído, contrato de agregadora (lembrando que `contratos` guarda uma linha por check-in nesses alunos) e 1º treino realizado; chama `fn_gerar_comissao('treino_experimental', ...)` deixando status `em_validacao`, descrição "Conversão de Treino Experimental (Wellhub/TotalPass)".
  - Gatilho no registro de treino concluído/presença que chama a função (dedupe já garantido por `fn_gerar_comissao` por origem).
  - RPC `fn_comissao_aprovar(_ids uuid[])` SECURITY DEFINER, só admin (`has_role`), muda `em_validacao` → `aprovado`, grava `aprovado_por` e audit_log; sem grant para `anon`.
  - Não altera `fn_tentar_comissao_experimental`, `trg_comissao_venda_paga` nem a carteira ativa.
- Frontend: em `/comissionamentos`, filtro/selo "Aguardando aprovação" e botões Aprovar (linha e seleção em lote), visíveis só para admin.
- Primeiro passo da implementação: confirmar no banco qual tabela marca o treino realizado e como o vínculo de agregadora é identificado, antes de escrever o gatilho.
- Testes: `src/test/comissoesFase2Agregadoras.test.ts` (regras da migration e RPC só admin) + ensaio SQL revertido com fixtures (sem experimental → nada; experimental + 1º treino → 1 comissão em validação; 2º treino → não duplica; aprovar como não-admin → erro). Rodar `bunx vitest run` e eslint.
