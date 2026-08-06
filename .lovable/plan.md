# Diagnóstico — Avaliações fragmentadas do Airton (somente leitura)

## 1. Dados reais no banco

Aluno: AIRTON LUIZ MORAES JUNIOR (`503a1d7d…`). Registros em `avaliacoes`:

| data | tipo | id (curto) | métricas | força | created_at (UTC) | laudo importado em |
|---|---|---|---|---|---|---|
| 2024-09-05 | funcional_v2 | 033341be | 9 | 6 (laudo **2024**) | 06/08 13:58:30 | 13:58:05 |
| 2024-09-05 | funcional_v2 | 7191278f | 9 | 6 (laudo **2025**) | 06/08 14:03:08 | 14:03:13 |
| 2024-09-05 | funcional_v2 | e49d395d | 0 | 6 (laudo **2024**, duplicado) | 06/08 14:04:54 | 14:04:33 |
| 2025-07-22 | funcional_v2 | 446cd360 | 0 | 6 (laudo **2025**, duplicado) | 06/08 14:03:48 | 14:03:27 |
| 2026-01-22 | funcional (legado) | db208cd2 | 0 | 0 | 11/06 | — |
| 2026-08-05 | funcional_v2 | e6b04e1c | 9 | 6 | 05/08 17:18 | manual (sem laudo) |
| 2026-08-06 | experimental | 2a6b8319 | 0 | 0 | 06/08 13:46 | — |

Confirmações sobre as datas: a tela está certa — é **22/07/2025** (não 21/07). A "avaliação de 22/01/2026" existe, mas é do tipo **`funcional` legado e está vazia** (sem métricas e sem força). A "de 03/08/2026" na verdade está gravada em **05/08/2026**.

São **três** linhas na mesma data 05/09/2024 (não duas): duas completas com conteúdos de força **diferentes** (uma do laudo 2024, outra do laudo 2025) e uma só-força duplicada.

## 2. Causa raiz — hipótese CONFIRMADA, e pior que o previsto

A sequência reconstruída pelos timestamps (`created_at` vs `dados.forca.importadoEm`) mostra dois defeitos combinados:

**(a) A busca do "par pendente" ignora a data.** Tanto `findFuncionalV2AguardandoForca` (`src/lib/kinologyImport.ts:116`) quanto `findFuncionalV2AguardandoMobilidade` (`MobilidadeTab.tsx:74`) pegam **a primeira linha `funcional_v2` do aluno, ordenada por data desc, que tenha um lado vazio** — sem nenhum filtro pela data que o usuário está lançando. Em lançamento retroativo isso mescla na linha errada.

**(b) O import de força SOBRESCREVE a data da linha alvo.** `PremiumKinologyImport.tsx:61` faz `update({ dados: novosDados, data: finalData })`. Ao mesclar numa linha de outra data, ele arrasta a mobilidade já existente para a data do laudo.

Sequência real:
1. 13:58 — import do laudo **2024** não achou pendente → criou `033341be` (data 05/09/2024, só força). Depois a mobilidade foi salva e mesclou nela → ficou completa. Correto.
2. ~14:03 — mobilidade da data 22/07/2025 foi salva; não havia linha só-força → criou `7191278f`, mobilidade-only.
3. 14:03:13 — import do laudo **2025** achou `7191278f` como "aguardando força" e mesclou nela, **sobrescrevendo a data para 05/09/2024** (a data do campo/laudo naquele momento). Resultado: a mobilidade de 2025 foi teleportada para 2024 → **duas linhas completas em 05/09/2024**.
4. 14:03:27 e 14:04:33 — o operador reimportou os dois laudos tentando corrigir; como já não havia linha "aguardando força", cada import criou uma **nova linha só-força** (`446cd360` em 22/07/2025 e `e49d395d` em 05/09/2024) → duplicatas.

Ou seja: a hipótese está confirmada, e há também o efeito colateral da sobrescrita de data — que é o que gerou a duplicidade na Timeline.

## 3. Por que o Comparativo mostra "—" e "Nº métricas = 0"

Confirmado. `useAlunoAvaliacoesConsolidadas` monta `funcional.history` a partir de um `.order("data", desc)` **sem desempate**; com três linhas na mesma data, a ordem entre elas é arbitrária no Postgres. O `nearest()` (`ComparativoTab.tsx:37`) usa `d < bestDiff` (estrito), então **fica com a primeira linha empatada que aparecer** — nesse caso `e49d395d`, que tem `metricas: []`. Daí `Score Mobilidade / Flexibilidade / Simetria / Risco = "—"` e `Nº métricas = 0`. O mesmo empate afeta `funcional.latest` na aba Visão Geral quando a data mais recente tiver duplicatas.

## 4. Extensão do problema

- **05/09/2024** — 3 linhas: 1 correta, 1 com mobilidade que pertence a 22/07/2025, 1 só-força duplicada.
- **22/07/2025** — 1 linha só-força; a mobilidade dessa data está presa na linha `7191278f` (datada 05/09/2024).
- **22/01/2026** — não é fragmentação: é uma linha `funcional` legada totalmente vazia (nunca preenchida). Aparece na Timeline mas não entra em nenhum score.
- **05/08/2026** — linha única e íntegra; sem problema.
- Nenhuma outra data afetada. O risco é sistêmico, porém: qualquer lançamento retroativo futuro reproduz o mesmo padrão.

## 5. Correções possíveis (para decisão — nada aplicado ainda)

**Dados (uma migração/insert pontual):**
- Mover a mobilidade de `7191278f` (md5 distinto, é a de 2025) para a linha `446cd360` (22/07/2025) e apagar `7191278f`.
- Apagar a linha só-força duplicada `e49d395d` (05/09/2024), já que `033341be` tem os mesmos exercícios (md5 idêntico) + mobilidade.
- Decidir o destino da linha vazia `db208cd2` (22/01/2026): apagar ou manter.

**Código (prevenção):**
- Casar por data: nas duas funções de "pendente", filtrar `.eq("data", dataEscolhida)` — mesclar só na linha da MESMA data; caso contrário, criar nova.
- Parar de sobrescrever `data` no merge do import Kinology, ou sobrescrever só quando a linha alvo for da mesma data.
- Desempate determinístico nas consultas (`.order("data", desc).order("created_at", desc)`) e preferir, em empate, a linha com mais dados — em `useAlunoAvaliacoesConsolidadas` e no `nearest()`.
- Opcional: consolidar no cliente linhas `funcional_v2` da mesma data ao montar o histórico, evitando duplicidade visual na Timeline.
