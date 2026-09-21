# Comparativo: ignorar avaliações duplicadas

## O problema

No modo "Automático (última vs. anterior)" o comparativo deste aluno está comparando a avaliação de 05/08/2026 com uma cópia dela mesma, registrada com data de 03/08/2026. Os valores de mobilidade são idênticos nas duas, e a cópia não tem os dados de força — por isso a tabela de força aparece vazia de um lado e nenhuma evolução aparece.

Essas cópias vieram de uma importação feita em 18/09: para cada avaliação real existe uma cópia com data um ou dois dias antes e sem força. O mesmo acontece com o par 22/07/2025 e 21/07/2025.

## O que será feito

Manter os registros no banco (nada é apagado) e fazer o comparativo ignorar cópias:

- Ao montar o histórico de avaliações funcionais, quando duas avaliações estiverem a até 3 dias de distância e tiverem exatamente os mesmos valores de mobilidade, apenas uma é mantida — a mais completa (a que tiver dados de força e/ou data mais recente).
- Com isso, o modo automático deste aluno passa a comparar 22/07/2025 → 05/08/2026, com força nos dois lados.
- A mesma limpeza vale para composição corporal e pliometria, pelo mesmo critério de valores iguais em datas próximas.
- O texto "Comparando X → Y" no cabeçalho passa a usar as datas realmente comparadas.

## Detalhes técnicos

- Alteração em `src/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas.ts`: função auxiliar `removerDuplicadas(history, chave)` aplicada a `funcHistory`, `compHistory` e `plioHistory` antes de montar `latest`/`history`. Chave = JSON estável dos valores comparáveis (métricas E/D; bf/peso/sigma7; salto/rsi/etc.). Janela de 3 dias; desempate por riqueza de dados (força presente, mais campos preenchidos) e depois data mais recente.
- Em `ComparativoTab.tsx`, o rótulo do modo automático passa a derivar das datas de `history[1]`/`history[0]` já deduplicados (hoje mistura `todasDatas[0]`).
- Nada muda nas abas de Mobilidade, Força, Composição ou no BodyMap além de não listarem pontos duplicados.
