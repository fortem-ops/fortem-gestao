# Remover as vendas repetidas da Nathália e desativar os planos vencidos

## 1. Vendas repetidas da Nathália
- Excluir as 8 vendas do Power ligadas aos planos repetidos (já desativados). Fica só a venda do plano ligado ao contrato ativo.
- Nenhuma delas tem pagamento na Rede nem link de pagamento. Contrato e mensalidades não mudam.

## 2. Planos ativos com data final já passada
Achei **17 planos** assim, cada um de um aluno diferente:

**Alunos que têm outro plano em vigor (6).** Para esses, a mudança é só limpeza:
- Fernanda Gallas (Start+, até 13/07)
- Mariana Chaves Petersen (Corrida - Start+, até 01/09)
- Betina Schneider de Lima (Corrida - Start+, até 02/09)
- Juliano Nugent (Corrida - Pro, até 03/09)
- Felipe Martins (Corrida - Pro, até 04/09)
- Mayara Squeff Janovik (Corrida - Pro, até 19/09)

**Alunos que ficam sem nenhum plano em vigor (11).** Esses passam a aparecer como inativos na Carteira, nos alertas e nos relatórios:
- Guilherme Silveira (até 28/06)
- Fernanda... não; Alice Brinckmann Oliveira Netto (até 17/07)
- Gabriela Balaguez, Paulo Sergio de Oliveira Machado, Eliezer Bernart, Eduardo C. Althaus e Alonso Alejandro Gonzalez Cornejo (todos até 26/07)
- Karina Sassi (até 01/08)
- Carlos Augusto Piccinini (até 30/08)
- Jean Rodrigues da Silva (até 04/09)
- Rafael Fernandes e Silva (até 13/09)

Nenhum dos 17 tem contrato em vigor. O que será feito:
- desativar os 17 planos;
- não alterar vendas, contratos, cobranças nem o cadastro do aluno.

## 3. Evitar que volte a acontecer
- Criar uma rotina diária automática que desativa planos com data final já passada. Planos com renovação automática ficam de fora, porque esses são renovados pela rotina de renovação.

## O que NÃO será feito
- Nenhuma cobrança ou estorno no cartão.

## Detalhes técnicos
- Vendas da Nathália a remover: `aluno_id=74bc8b71` e `plano_id <> bc6cfb40`, junto com as cobranças e inadimplências ligadas a elas, se existirem.
- `UPDATE planos SET ativo=false WHERE ativo AND data_fim < current_date` (17 linhas).
- Migração: função SECURITY DEFINER `fn_desativar_planos_vencidos()`, rodando pelo pg_cron diariamente às 03:30. Ela desativa os planos com `ativo AND data_fim < current_date AND NOT coalesce(renovacao_automatica,false)` e grava no audit_log.
