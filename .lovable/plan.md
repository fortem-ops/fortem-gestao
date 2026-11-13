# Lançar Folha: escolher Salário, 13º ou Férias + data de vencimento

## O que muda para você
No botão **Lançar Folha**, antes de subir o PDF, aparecem dois campos novos que valem para o lote inteiro:
- **Tipo de pagamento:** Salário · 13º – 1ª parcela · 13º – 2ª parcela · Férias
- **Data de vencimento:** um só dia para todos (ex.: 30/11 para a 1ª parcela do 13º)

Depois é igual a hoje: sobe o PDF com os holerites, confere as linhas e lança. Cada funcionário vira uma despesa via PIX na subcategoria pessoal dele.
- Data futura: nasce **pendente** e aparece na fila de Pagamentos Pix (você revisa e aprova o lote no Inter, como hoje).
- Data de hoje ou passada: nasce **paga** (lançamento retroativo).

## Como cada tipo aparece
- Descrição: "Salário Fulano (nov/2026)", "13º 1ª parcela Fulano (2026)", "13º 2ª parcela Fulano (2026)", "Férias Fulano (nov/2026)".
- Valor = líquido do holerite (Total de Vencimentos − Total de Descontos), como já é no salário.
- Detalhamento completo do holerite continua na observação.

## Proteção contra duplicidade
Cada tipo tem sua própria trava, separada do salário:
- Salário: continua como hoje (um por funcionário por mês).
- 13º: uma 1ª parcela e uma 2ª parcela por funcionário por ano.
- Férias: uma por funcionário por mês de competência.
Lançar o 13º não bloqueia nem sobrescreve o salário do mês, e vice-versa. Mesma regra de hoje para reenvio: igual → "Nada a atualizar"; diferente → pede confirmação; já conciliado ou Pix enviado ao Inter → não altera.

## Leitura do PDF
A leitura passa a reconhecer as linhas típicas do 13º ("13º Salário", "Adiantamento 13º", "INSS 13º", "Desconto 1ª parcela") e de recibo de férias, levando-as para os campos certos ou para "Outros". Se o tipo escolhido não bater com o holerite (ex.: escolheu 13º e o PDF é de salário comum), a linha mostra um aviso antes de lançar.

## Fora do escopo
Não muda cálculo de encargos, comissões, DSR nem a forma de pagamento (sempre PIX). Nada é lançado automaticamente sem você clicar em lançar.

## Detalhes técnicos
- `LancarFolhaDialog.tsx`: seletor `tipoFolha` e `dataVencimento` no topo do modo lote; `data_competencia`/`data_pagamento` = data escolhida (hoje fixo em dia 05 do mês seguinte só para Salário, mantido como padrão sugerido).
- Trava por prefixo da descrição + rótulo (`Salário%`, `13º 1ª%`, `13º 2ª%`, `Férias%`), sem migração de banco.
- `ler-holerite`: novas regras em `mapear` para itens de 13º; devolve `tipoDetectado` para o aviso de divergência. Republicar a função.
- Lógica pura de descrição/trava extraída para `src/lib/folhaTipos.ts` com testes (descrições, data de vencimento, trava independente entre tipos, pendente vs pago).
- Atualizar memória "Lançar Folha" com os tipos novos; rodar `bunx vitest run` e eslint.
