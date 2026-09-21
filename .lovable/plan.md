# Comparativo: leitura de 04/03/2026

## O que está acontecendo

A avaliação de 04/03/2026 da aluna está gravada em **dois registros separados** com a mesma data:

- um registro só com a **força** (dinamometria), sem nenhuma medida de mobilidade;
- outro registro só com as **9 medidas de mobilidade/flexibilidade**, sem força.

O Comparativo trata cada registro como uma avaliação distinta. Assim, no modo automático ele acaba comparando o registro de força de 04/03/2026 contra o registro de mobilidade da mesma data — e o resultado aparece vazio, como se 04/03/2026 não tivesse leitura.

O mesmo acontece com 04/04/2024, que também está dividida em dois registros (força e mobilidade).

## Correção proposta

Juntar, antes de qualquer comparação, os registros funcionais da **mesma data** em uma única avaliação:

- as medidas de mobilidade/flexibilidade de um registro e a força do outro passam a formar uma única leitura de 04/03/2026;
- se houver medida repetida na mesma data, vale a do registro mais recente (o que tiver mais dados preenchidos);
- a remoção de cópias duplicadas (registros iguais a poucos dias de distância) continua funcionando como hoje, aplicada depois da junção.

Com isso o Comparativo passa a mostrar 04/03/2026 como uma avaliação completa (mobilidade + força) e o modo automático compara 04/08/2025 → 04/03/2026. A linha do tempo de evolução e o "última avaliação" também passam a exibir a data completa.

Nenhum dado do banco é alterado — a junção acontece apenas na leitura.

## Detalhes técnicos

`src/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas.ts`:

- nova função `mesclarPorData(snapshots)` aplicada aos `FuncionalSnapshot` logo após o `parseFuncional`, antes de `removerDuplicadas`: agrupa por `data`, faz merge de `metricas` por nome de métrica (mantendo a entrada com mais campos preenchidos / mais recente) e usa o primeiro `forca[]` não vazio da data;
- o `history` resultante continua ordenado da data mais recente para a mais antiga;
- `latestFunc` / `mergedFunc` permanecem como estão (o merge por data já resolve o caso em que força e métricas vinham separadas).

Sem mudanças em `ComparativoTab.tsx`, nas outras abas ou no banco.
