# Créditos de reabilitação e mensalidades erradas — diagnóstico e correção

Investiguei os dois casos da FABIANE ELIZABETHA DE MORAES RIBEIRO direto no banco e ampliei a checagem para todos os alunos. Os dois problemas são reais, com causas diferentes.

## Caso 1 — Créditos de reabilitação divergentes

O perfil da aluna mostra dois blocos com números diferentes para o mesmo serviço:

- "Créditos de Serviços" (dentro do Plano Contratado): Reabilitação 2/2 usados — Esgotado
- "Serviços e Créditos Contratados": Reabilitação 2 iniciais, 1 usado, 1 restante

Motivo: existem **dois controles paralelos de saldo** que nunca conversam entre si.

1. O bloco do plano soma os registros de uso da tabela de consumos (`consumo_servicos`) contra os serviços descritos no plano.
2. A tabela "Serviços e Créditos Contratados" lê o contador próprio da tabela de créditos (`creditos_aluno.quantidade_usada`), que só é movimentado pelo agendamento na agenda — usos lançados manualmente não a atualizam.

Dados confirmados da aluna: 2 consultas de reabilitação lançadas manualmente (13/03 e 04/05) e 1 avaliação funcional (12/02). No registro de créditos consta apenas 1 reabilitação usada e 0 avaliações usadas.

Verificação ampliada — 9 divergências entre os dois controles, em 8 alunos: Bárbara Borques, Camille Dame, Daniel Muniz, Fabiane Elizabetha (2 casos), João Vicente Laste, Maurício Filippon, Sofia Robin, Zilmara Bonai. Praticamente todas em Avaliação Funcional lançada manualmente.

Dois problemas estruturais adicionais encontrados:

- Na renovação do plano, os consumos antigos foram **duplicados** para o novo plano (a Fabiane tem 6 registros de consumo que representam 3 atendimentos reais), inflando o "usado" no bloco do plano.
- Todos os 252 registros de crédito de origem "plano" têm o campo de origem apontando para um identificador que não existe em nenhuma tabela de planos, contratos ou ciclos — ou seja, não é possível hoje relacionar crédito com o plano que o gerou.

### Correção proposta

1. Definir a tabela de créditos (`creditos_aluno`) como fonte única de verdade de saldo, e o consumo (`consumo_servicos`) como o histórico dos atendimentos.
2. Criar gatilho no banco para que qualquer lançamento/remoção de consumo (manual ou por agenda) debite/estorne o crédito correspondente da atividade, com a tradução dos rótulos ("Consultas Reabilitação" → "Reabilitação", etc.).
3. Corrigir o vínculo de origem dos créditos de plano para apontar para o plano do aluno, e passar a gravar corretamente nas próximas emissões.
4. Fazer o bloco "Créditos de Serviços" do Plano Contratado ler o mesmo saldo da tabela de créditos (função compartilhada), eliminando o cálculo próprio, para os dois blocos nunca mais divergirem.
5. Deduplicar os consumos copiados na renovação e recalcular o `quantidade_usada` de todos os créditos ativos a partir do histórico real de atendimentos (um script de ajuste único, com relatório antes/depois para você aprovar).

## Caso 2 — Mensalidade de R$ 6.228,00 em vez de R$ 519,00

O contrato ativo da aluna é anual, 12 parcelas, com valor total anual de R$ 6.228,00 (= 12 × R$ 519,00). Porém:

- O campo de valor cobrado do contrato guarda 6.228,00 (valor anual) no lugar da mensalidade.
- As parcelas 1 a 6 estão corretas (R$ 519,00, pagas), mas as parcelas 7 a 12 ficaram com R$ 6.228,00 cada — inclusive a parcela 7, já em atraso, cobrando o ano inteiro.

Causa: o contrato foi criado passando o valor total anual como se fosse o valor mensal; uma correção posterior ajustou apenas as parcelas já pagas e deixou as futuras com o valor cheio.

Verificação ampliada — 3 contratos com esse mesmo padrão (valor cobrado = total anual):

| Aluno | Valor correto/mês | Parcelas erradas |
| --- | --- | --- |
| FABIANE ELIZABETHA DE MORAES RIBEIRO | R$ 519,00 | 6 (parcelas 7–12, R$ 6.228,00) |
| BÁRBARA BORQUES SANTANA | R$ 399,00 | 10 (parcelas 3–12, R$ 4.788,00) |
| DÉBORA PERIN DECOL | R$ 399,00 | 11 (1 paga + 10 canceladas, R$ 4.788,00) |

Todos os outros contratos parcelados estão consistentes.

### Correção proposta

1. Ajustar os 3 contratos: valor cobrado passa a ser a mensalidade real, e as parcelas em aberto/atrasadas passam ao valor mensal correto. Parcelas já pagas com valor divergente e as canceladas ficam apenas relatadas (não altero histórico financeiro sem sua autorização explícita).
2. Blindar a criação de contratos: na função que gera contrato + parcelas, validar que o valor recebido é a mensalidade — se o valor informado for múltiplo do número de parcelas e coincidir com o total do plano, dividir; se for incoerente, recusar com erro claro em vez de gravar valores errados.
3. Adicionar checagem de consistência na tela do contrato, sinalizando quando a soma das parcelas não fecha com o valor do contrato.

## Detalhes técnicos

- Frontend: `src/components/student/StudentPlan.tsx` (bloco "Créditos de Serviços" passa a usar `src/lib/creditosServicos.ts` sobre `creditos_aluno`), `src/components/student/StudentServicos.tsx`, `src/pages/alunos/ContratoFinanceiro.tsx` (aviso de inconsistência de parcelas).
- Banco: gatilho novo em `consumo_servicos` para debitar/estornar `creditos_aluno`; ajuste em `fn_criar_contrato_recorrencia` (validação de `p_valor_mensal`); backfill de `creditos_aluno.origem_id`.
- Scripts de dados: recálculo de `quantidade_usada`, dedupe de consumos duplicados na renovação, correção das parcelas dos 3 contratos — todos com relatório prévio.
- Testes: novos casos em `src/test/creditos.test.ts` e `src/lib/__tests__/contratos-calc.test.ts` (mensalidade × parcelas × total, débito de crédito por consumo manual, estorno na exclusão).
