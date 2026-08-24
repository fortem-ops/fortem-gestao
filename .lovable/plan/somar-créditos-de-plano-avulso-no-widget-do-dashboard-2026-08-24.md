# Somar créditos de Plano + Avulso no widget do Dashboard

## O caso do Juliano Nugent (verificado no banco)

- Plano ativo "Pro" inclui **2 Consultas Reabilitação**, sem nenhum consumo registrado → 2 créditos de plano disponíveis.
- Ledger de créditos tem uma linha avulsa (origem: venda de serviço) de Reabilitação: 3 comprados, 1 usado → 2 créditos avulsos.
- Total real: **4 créditos de Reabilitação**.

O widget hoje mostra apenas 2 porque a regra atual dá prioridade total ao ledger e descarta o cálculo do plano quando existe qualquer linha de crédito para aquela atividade. Isso está correto para evitar duplicidade quando o crédito do plano já foi gravado no ledger, mas erra quando a linha do ledger é de origem **avulsa** — aí são saldos distintos que devem somar.

Existem hoje 39 clientes com créditos no ledger e plano ativo com serviços inclusos, então o ajuste vale para vários casos além do Juliano.

## Comportamento novo

- O saldo passa a somar as duas fontes quando elas são independentes:
  - créditos avulsos (comprados como serviço) sempre entram na soma;
  - o saldo calculado do plano entra também, **exceto** quando já existe crédito de origem "plano" no ledger para a mesma atividade (aí o ledger vence, como hoje, para não duplicar).
- A linha do cliente mostra o total somado e a etiqueta de origem passa a refletir a composição: `PLANO`, `AVULSO` ou `PLANO+AVULSO`.
- Nos casos mistos, um detalhe discreto indica a divisão (ex.: "4 · 2 plano + 2 avulso").
- Contagem de clientes no topo, filtro por atividade (Nutrição/Reabilitação) e clique para o perfil continuam iguais.

## Detalhes técnicos

- `src/lib/creditosServicos.ts`: adicionar função nova `saldoDetalhadoPorAtividade(planoServicos, consumos, creditos)` que retorna `{ saldoPlano, saldoAvulso, ilimitado }` por atividade. O tipo `CreditoAlunoRow` ganha `origem_tipo?: string | null`; a supressão do cálculo do plano passa a considerar só linhas com `origem_tipo === "plano"`. `saldoTotalPorAtividade` fica intacta (PortalAgenda e testes atuais seguem inalterados).
- `src/components/dashboard/ClientesCreditosWidget.tsx`: incluir `origem_tipo` no select de `creditos_aluno`, usar a função nova, somar plano + avulso e derivar a etiqueta de origem.
- `src/test/creditos.test.ts`: novos casos cobrindo soma plano+avulso, supressão quando o ledger é de origem plano, e caso só-plano/só-avulso.
- Sem alteração de banco, RLS ou dados.
