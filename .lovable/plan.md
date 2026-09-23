# Hierarquia de plano principal + valor da parcela na Auditoria

## O que encontrei (investigação no banco)

**1. A função `fn_plano_principal_ativo` NÃO está retornando Corrida para a Mayara.**
Testei as três alunas direto no banco:

| Aluna | Resultado hoje |
|---|---|
| Mayara Squeff Janovik | "Pro" (treinamento_funcional, R$ 5.988 = R$ 499/mês) — correto |
| Gabrielle Dias Salton | nulo (só tem Corrida ativa) — **errado**, deveria ser Corrida |
| Juliana Gonçalves Moreno | nulo (só tem Corrida ativa) — **errado**, deveria ser Corrida |

A função já filtra `atividade = 'treinamento_funcional'`, então ela nunca devolve Corrida — nem quando deveria (a exceção). A Mayara, aliás, tem plano **Pro**, não VIP.

**2. O que realmente gerou o alerta errado da Mayara** é a checagem de valor da Auditoria, não a função:
> "Cobrança de 140,00 (venc. 19/07/2026) difere do valor contratado (1.680,00) e do valor mensal do plano vigente (499,00)."

A cobrança de R$ 140,00 pertence ao **contrato de Corrida** (total R$ 1.680,00 em 12x R$ 140,00 — está certíssimo), mas a checagem compara com (a) o valor **total** do contrato e (b) o plano principal do aluno (Pro), que não tem nada a ver com aquele contrato. Duas falhas somadas.

## Correções

### 1. `fn_plano_principal_ativo` — hierarquia explícita por tipo
Reescrever a ordenação para considerar o tipo do plano, e não só a data:

1. Planos de tipo principal (Start, Start+, Power, Pro, Max, VIP, Gympass/Wellhub, Total Pass, e qualquer plano de `atividade = 'treinamento_funcional'`) vêm sempre primeiro, independente do valor.
2. Corrida só é escolhida quando o aluno **não** tem nenhum plano do grupo acima (casos Gabrielle e Juliana).
3. Dentro do mesmo grupo, mantém o critério atual: vigente primeiro, depois o mais recente.

Mesma assinatura e mesmo retorno (`SETOF planos`), para não afetar os 7+ consumidores.

### 2. Checagem "valor_divergente_plano" — usar a parcela e o plano do contrato
- Comparar com o **plano do próprio contrato** (`contratos.plano_id`), não com o plano principal do aluno.
- Comparar com o **valor da parcela**: `valor_cobrado / parcelas` quando houver parcelas, além do valor total e do mensal do plano do contrato.
- Só alerta quando a cobrança diverge de **todas** essas referências.

Com isso, cobranças de contratos de Corrida param de ser comparadas contra o plano de treino do aluno.

### 3. Reprocessamento
Apagar os itens abertos de `valor_divergente_plano`, rodar `fn_auditoria_fiscal_pagamentos` e reportar a contagem final por subtipo.

## Detalhes técnicos
- Uma migração: `CREATE OR REPLACE` das duas funções. Sem nova tabela, sem mudança de RLS, sem alteração de dados além da limpeza dos falsos positivos.
- Os consumidores possivelmente afetados pela mudança de comportamento (alunos que só têm Corrida passam a ter plano principal em vez de nulo) serão listados no relatório final: funções SQL que chamam `fn_plano_principal_ativo` e telas que usam o equivalente no frontend (`planoPrincipal.ts`). Nenhuma dessas telas será alterada nesta entrega.
