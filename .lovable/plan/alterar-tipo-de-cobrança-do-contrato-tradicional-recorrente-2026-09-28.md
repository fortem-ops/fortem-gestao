# Alterar tipo de cobrança do contrato (tradicional <-> recorrente)

## O que encontrei na Paula Cerski Lavratti

- Venda do Power (22/09) gravada como **tradicional, pagamento pendente**: uma única cobrança de R$ 6.588,00 com vencimento 28/09/2026.
- Além disso, o contrato do Power (28/09/2026 → 28/09/2027) foi **encerrado por engano** em 27/09 pela renovação automática do plano Start antigo (que gerou a mensalidade de R$ 579 que aparece em Inadimplentes). O plano Start já está inativo, mas o contrato do Power ficou marcado como "encerrado".

## O que muda na tela

No card Contrato do perfil do aluno (Admin/Coordenação), novo botão **"Alterar tipo de cobrança"**, disponível quando o contrato não tem nenhuma cobrança paga:

- **Tradicional → Recorrente**: escolhe forma (cartão recorrente, Pix automático, boleto ou pendente), dia de vencimento e se aplica a taxa de R$ 20/mês (desmarcada por padrão). As cobranças em aberto são substituídas por N mensalidades (vigência em meses), valor = total ÷ N (+ taxa, se marcada). Para a Paula: 12 × R$ 549,00, a partir de 28/09/2026.
- **Recorrente → Tradicional**: escolhe forma e nº de parcelas (1–12). As mensalidades em aberto são substituídas pelas parcelas do valor restante.
- Resumo antes de confirmar (quantas cobranças saem, quantas entram, valores e datas).
- Se houver alguma cobrança paga ou estornada, o botão fica bloqueado com aviso (evita mexer em histórico financeiro).
- Nada é cobrado no cartão nem enviado à Rede.

## Correção pontual da Paula (após aprovação)

1. Reativar o contrato do Power (status ativo, limpar a observação de encerramento indevido).
2. Excluir a mensalidade de R$ 579 de 27/09 do Start (e a inadimplência), já que o Start foi substituído pelo Power.
3. Converter para recorrência mensal: 12 × R$ 549,00 (sem taxa), vencendo todo dia 28, forma "cartão recorrência"; venda passa a tipo recorrência.

## Detalhes técnicos

- Nova função SQL `fn_alterar_tipo_cobranca_contrato(p_contrato_id, p_tipo, p_forma, p_parcelas, p_dia_venc, p_aplicar_taxa)` SECURITY DEFINER, só admin/coordenador (has_role), grants a authenticated/service_role: valida que não há cobrança paga/estornada/com tid; apaga cobranças pendentes/atrasadas e suas inadimplências; atualiza `contratos` (forma_pagamento, parcelas, taxa_recorrencia, valor_cobrado), `vendas` vinculada (tipo_cobranca, forma/modalidade, parcelas, taxa_mensal, valor_final) e `planos` (forma_pagamento_padrao, renovacao_automatica); insere as novas cobranças (numero_ciclo 1..N, status pendente/atrasado conforme data em America/Sao_Paulo, meio_registro manual_admin); grava em audit_log.
- Novo `src/components/financeiro/AlterarTipoCobrancaDialog.tsx` + botão em `src/pages/alunos/ContratoFinanceiro.tsx`, invalidando cobrancas-contrato, contratos, vendas e inadimplentes.
- Investigar e corrigir por que a renovação do Start encerrou o contrato do Power (rotina de renovação deve ignorar planos já substituídos por um plano ativo mais novo) — confirmo a causa antes de alterar.
