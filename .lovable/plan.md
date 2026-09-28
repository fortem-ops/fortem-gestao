# Corrigir vencimento e renovação da Luiza Machado Futuro

## O que está acontecendo (confirmado no banco)
- Mensalidade do ciclo 1: vencimento já é 04/10/2026, mas o status ficou "atrasado". Ao alterar a data, a tela só troca data e valor e não recalcula o status.
- Plano: término 04/10/2026 foi salvo, mas a "próxima renovação" continua 25/10/2026, e o contrato vigente segue terminando em 25/10. Editar o término não atualiza essas duas datas.

## Correções
1. **Alterar dados da venda**: ao salvar uma nova data de vencimento, recalcular o status: data futura ou de hoje = "pendente"; data passada = "atrasado". Se virar pendente, a mensalidade sai de Inadimplentes.
2. **Editar plano (término)**: quando o plano tem renovação automática, ao mudar o término também mudar a próxima renovação para a mesma data e ajustar o término do contrato vigente.
3. **Luiza**: corrigir os dados atuais — mensalidade de 04/10 para "pendente" (e remover a inadimplência ligada), próxima renovação e término do contrato para 04/10/2026.

Nada é enviado para a Rede; nenhuma cobrança real.

## Detalhes técnicos
- `AlterarDadosVendaDialog.tsx`: incluir `status` no update conforme data vs. hoje (fuso Brasília); apagar `inadimplencias` abertas da cobrança quando virar pendente; invalidar caches de inadimplentes.
- `StudentPlan.tsx` (edições em ~l.343 e ~l.1026): se `renovacao_automatica`, gravar `proxima_renovacao = data_fim` e atualizar `contratos.data_fim` do contrato ativo do aluno.
- Ajuste de dados via SQL: cobrança 3bc16946, plano 03229ea3, contrato f7720d59.
