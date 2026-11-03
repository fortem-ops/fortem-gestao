# Saídas do Inter sem despesa: aviso e conciliação

## Situação hoje
- A rotina diária `conciliar-extrato-diario` liga saídas do Inter a despesas só quando o valor é igual (ou por regra de PIX). Quando não acha nada, só conta como "sem candidato" no resumo.
- Hoje há 44 saídas no extrato e 27 conciliadas, ou seja, 17 saídas sem despesa e sem aviso.
- A tela Conciliação Bancária permite vincular à mão, mas só a despesas com o mesmo valor e sem corrigir valores.

## O que muda para a equipe
1. **Aviso automático**: ao final da rotina diária, cada saída nova sem despesa gera um aviso no Notificar (categoria Financeiro) para os administradores, com data, valor e descrição do Inter, e um botão "Conciliar". Um aviso só por saída (sem repetir nos dias seguintes).
2. **Janela "Conciliar saída"** (abre pelo aviso ou pela tela Conciliação Bancária), com duas opções:
   - **Vincular a uma despesa existente com valor diferente**: lista despesas pendentes próximas da data (±15 dias) e de valor parecido. Mostra "Valor lançado R$ X → valor do banco R$ Y". Ao confirmar, a despesa passa a ter o valor do banco, fica paga na data do extrato e conciliada. O valor antigo fica registrado no histórico.
   - **Criar nova despesa**: formulário já preenchido com data, valor e descrição do Inter. Você escolhe categoria, fornecedor e centro, e ela entra na tabela Despesas já paga e conciliada.
3. Ao concluir, o aviso é marcado como resolvido. "Desfazer" na Conciliação Bancária volta a despesa ao valor anterior.

## Fora do escopo
- Entradas (créditos) continuam como estão.
- Nenhuma conciliação acontece sozinha com valor diferente: sempre pede confirmação de uma pessoa.
- Despesas já pagas e conciliadas não aparecem como opção.

## Detalhes técnicos
- Migração: em `conciliacoes_bancarias`, acrescentar `valor_anterior numeric null` e `notificacao_id uuid null`; índice único parcial para não duplicar o aviso por `movimento_id`.
- RPC `fn_conciliar_saida_despesa(movimento_id, despesa_id)` (somente admin/coordenador ativo, SECURITY DEFINER) que trava a linha, confere que o movimento é `D` e ainda não está vinculado, grava `valor_anterior`, atualiza `valor`/`valor_pago`/`status`/`data_pagamento`/`conciliado` e insere o vínculo `tipo_match='manual'`, `confianca='ajustada'` numa transação só.
- RPC `fn_conciliar_saida_nova_despesa(movimento_id, dados)`, que cria a despesa só com categorias de `nivel` preenchido e vincula em seguida.
- Desfazer: restaura `valor_anterior` quando existir.
- `conciliar-extrato-diario`: no caso "sem candidato" de saídas, cria aviso via função de notificação existente, de forma idempotente. A lógica de conciliação atual continua igual.
- Frontend: novo `ConciliarSaidaDialog` usado em `ConciliacaoBancaria.tsx` e aberto pelo link do aviso (`/financeiro/conciliacao?mov=<id>`).
- Testes: diferença de valor grava o valor do banco e guarda o anterior; desfazer restaura; movimento já vinculado é recusado; aviso não duplica.
- Ensaio revertido no banco antes de concluir, com rollback em `scripts/`.
