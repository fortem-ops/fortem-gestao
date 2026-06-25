## Histórico de pagamentos em Financeiro > Contratos

Hoje a tela mostra **1 linha por contrato** (com a próxima cobrança pendente). Vou trocar a tabela para mostrar **1 linha por cobrança**, incluindo as já pagas — exatamente o histórico que o filtro de período deve revelar.

### Comportamento

- Cada contrato pode aparecer várias vezes (uma por cobrança).
- Coluna "Data" = `data_vencimento` (ou `data_pagamento` quando paga, dependendo do filtro — ver abaixo).
- Status pagamento por linha: **Pago** (verde), **Pendente** (amarelo, vencimento ≥ hoje), **Vencida** (vermelho, vencimento < hoje).
- Ordem cronológica crescente por data de vencimento.
- Filtros existentes (status de contrato, plano, forma de pagamento, busca por aluno) continuam funcionando.
- Filtro **Período** agora atua sobre `data_vencimento` da cobrança. Exemplo: "Mês atual" → todas as cobranças (pagas + pendentes + vencidas) com vencimento no mês corrente.
- Clique no nome do aluno continua levando para `Perfil > Contrato`.

### Colunas

| Aluno | Plano | Vencimento | Pagamento | Valor | Forma | Status pagamento | Status contrato |

- **Vencimento**: `data_vencimento` formatada.
- **Pagamento**: `data_pagamento` quando paga, senão "—".
- **Valor**: `valor` da cobrança.
- **Forma**: `forma_pagamento` da cobrança (fallback para a do contrato).

### KPIs (mantidos, com pequenos ajustes)

- Contratos ativos / Inadimplentes / Renovações: continuam por contrato.
- "Receita prevista (mês)" → recalcular como soma das cobranças do mês atual (pagas + pendentes), ficando coerente com a nova granularidade.
- Acrescentar mini-resumo do recorte atual: **Recebido no período** (soma de pagas) e **A receber no período** (soma de pendentes + vencidas), visíveis acima da tabela.

### Implementação

- `src/hooks/useContratos.ts`: novo hook `useCobrancasListagem(filtroStatusContrato)` que faz `select` em `cobrancas` com join `contratos(... , alunos(id, nome, email))` e devolve cada cobrança achatada com os campos do contrato/aluno. Mantém o hook antigo (`useTodosContratos`) intacto para outras telas.
- `src/pages/financeiro/Contratos.tsx`: trocar fonte de dados para o novo hook, ajustar `useMemo` de filtragem (período aplica sobre `data_vencimento`), reescrever tabela com as colunas acima, manter filtros e DatePickers já criados.

Sem alterações de schema, RLS ou edge function.