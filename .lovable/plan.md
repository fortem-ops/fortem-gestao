# Resultados em números absolutos (sem classificações textuais)

Investigação concluída. Abaixo o diagnóstico ponto a ponto (A–E) e o plano de execução.

## A) Onde vivem as classificações Excelente/Bom/Médio/Regular/Fraco

Fonte única: `src/lib/mock-data.ts` — `AssessmentClassification`, `assessmentReferences` (faixas por métrica), `classifyAngle()`, `getClassificationColor()`.

Consumidores confirmados:

| Arquivo | Uso |
|---|---|
| `src/lib/mock-data.ts` | define tipos, faixas, `classifyAngle`, cores |
| `src/components/student/assessment/AssessmentForm.tsx` | classifica ao digitar e grava `leftClass/rightClass` |
| `src/components/student/assessment/funcionalV2/FuncionalV2Assessment.tsx` | idem (formulário `/avaliacoes`) + mostra classificação de força |
| `src/components/student/assessment/funcionalV2/FuncionalV2Viewer.tsx` | exibe colunas de classificação (mob/flex e força) |
| `src/components/student/assessment/AssessmentViewerDialog.tsx` | tabela + coluna "Classificação" + `BodyDiagram` |
| `src/components/student/assessment/BodyDiagram.tsx` | cor e legenda por categoria fixa |
| `src/components/student/assessment/exportAssessmentPDF.ts` | coluna "Classificação" no PDF |
| `src/components/avaliacoes-premium/tabs/MobilidadeTab.tsx` | `classifyAngle` só na gravação (a tabela já mostra ° puro) |
| `src/components/avaliacoes-premium/scoringPremium.ts` | score de flexibilidade derivado de `leftClass/rightClass` |
| `src/components/avaliacoes-premium/recomendacoesEngine.ts` | dispara recomendações quando classe é Fraco/Regular |
| `src/pages/portal/PortalHome.tsx` | "score geral" e contagem de métricas em atenção via classes |
| `funcionalV2/bodyMapLogic.ts` | `CLASS_SCORE`, `severityFromClass`, `SEVERITY_LABEL`, `classifyForca` |
| `src/lib/kinologyImport.ts` | grava `classificacao` textual em cada exercício de força |

Ponto crítico: `leftClass`/`rightClass` e `forca[].classificacao` são **persistidos no JSONB** de `avaliacoes.dados`. Retirar a gravação quebra `scoringPremium` (flexibilidade) e `PortalHome` para avaliações novas. Ver ordem de execução.

## B) Como o BodyMap decide a cor hoje

`BodyMapSVG` colore por `SEVERITY_COLOR_VAR[state.severity]`, com `severity` derivada de score 0–100 em 5 degraus fixos (`severityFromScore`). Mas o dado bruto de assimetria **já existe**: `RegionState.asymmetry` (% de diferença E/D calculado em `analyze()`), `analysis.metricAsymmetries[].diff` e, na camada Força, `classifyForca().assimetria`. Ou seja, o gradiente contínuo é viável sem novo cálculo — basta mapear `asymmetry` (0…30%+) para uma rampa de cor (verde → âmbar → vermelho) via interpolação HSL. Hoje o halo só aparece quando `asymmetry >= 15`; isso vira opacidade proporcional. Textos de categoria a remover: legenda `LEGEND` no `BodyMap.tsx`, `SEVERITY_LABEL` no tooltip do `BodyMapSVG`, rótulos BAIXO/ATENÇÃO/ALTO em `RegionListPanel`/`buildForcaAttentionList`.

## C) Avaliação anterior por métrica individual

Não existe pronto. `useAlunoAvaliacoesConsolidadas` já traz `funcional.history` (todas as avaliações ordenadas por data desc, cada uma com `metricas[]`), e `MobilidadeTab` já carrega seu próprio histórico completo. Falta apenas casar métrica a métrica com a avaliação imediatamente anterior à selecionada — trabalho de derivação em memória, sem query nova.

Média da população Fortem: também já disponível — `useMobilidadeReferenceData()` devolve os valores por métrica/sexo e `MobilidadeTab` já calcula média/σ (`statsFromArray`) para as curvas.

## D) Grupo funcional (superior/inferior) na força

Não existe. `forca_amostras_fortem` tem só `movimento, sexo, idade, valor_kgf`; `fn_forca_comparativo` calcula percentil por movimento isolado. Em `bodyMapLogic.ts` existe `FORCA_REGIONS` (movimento → região do corpo), do qual dá para **derivar** o grupo, mas o mapa explícito precisa ser criado — proposta: constante `FORCA_GRUPO_FUNCIONAL` em `bodyMapLogic.ts` (ombro/cotovelo/punho = superior; quadril/joelho/tornozelo = inferior).

Premissa que assumo (corrija se for outra): o percentil por movimento continua vindo do RPC atual; o que muda é que o **ranking e a leitura comparativa acontecem só dentro do grupo** (tabela agrupada em "Membros superiores" e "Membros inferiores", com percentil médio do grupo), e some qualquer destaque de "exercício mais fraco" global.

## E) Impacto fora do visual

- **PDF** `exportAssessmentPDF.ts`: coluna "Classificação" alimentada por `AssessmentViewerDialog` — quebra visualmente se o campo sumir.
- **Scoring**: `scoringPremium.flexibilidade` depende 100% das classes; `bodyMapLogic.CLASS_SCORE` é fallback quando não há base de percentil (métrica com n<15). Remover as classes sem substituto derruba scores para alunos sem base suficiente.
- **Portal do aluno**: `PortalHome` calcula score e "métricas em atenção" a partir das classes.
- **Recomendações**: `recomendacoesEngine` dispara por classe Fraco/Regular.
- **Kinology**: `kinologyImport.ts` grava `classificacao` no JSONB (dado histórico).
- Sem impacto em comissão, financeiro ou RLS.

## Plano de execução (ordem sugerida)

1. **Camada de dados (sem UI)** — em `bodyMapLogic.ts`: `FORCA_GRUPO_FUNCIONAL`, helper `corGradienteAssimetria(pct)` (rampa contínua) e `contarAssimetriasPorFaixa(analysis)` devolvendo `{ alta: >20%, moderada: 10–20%, baixa: <10% }`. Novo helper `compararComAnterior(history, metrica)`. Testes Vitest para cada um.
2. **BodyMap global** — `BodyMapSVG` passa a colorir halos/pontos/formas musculares pelo gradiente de `asymmetry`; remove `SEVERITY_LABEL` do tooltip (fica região + valor ° + % assimetria); `BodyMap.tsx` troca a legenda categórica por uma barra de gradiente contínua sem rótulos de classe; `RegionListPanel` deixa de exibir BAIXO/ATENÇÃO/ALTO. Vale automaticamente para Premium, Portal e `/avaliacoes`.
3. **Cards de resumo** — `DashboardSummary` + `DashboardScoreCard`: Mobilidade/Flexibilidade/Força mostram contagem de assimetrias; card de Risco vira 3 contadores por faixa; novo banner "Resumo geral: N alertas ativos — X elevada(s), Y moderada(s)" no topo de `AvaliacoesPremium.tsx`.
4. **Mobilidade/Flexibilidade** — `MobilidadeTab`: colunas E/D em °, média Fortem (mesmo sexo) e delta vs. avaliação anterior (↑/↓ em °), zero rótulos de classe. Mesmo tratamento nas linhas de mobilidade do `ComparativoTab`.
5. **Força** — `ForcaTab` agrupado por membros superiores/inferiores, percentil lido dentro do grupo, coluna "Risco" textual removida (fica só o % com cor do gradiente).
6. **Telas antigas e portal** — `FuncionalV2Viewer`, `FuncionalV2Assessment`, `AssessmentViewerDialog`, `AssessmentForm`, `BodyDiagram` e `exportAssessmentPDF` perdem as colunas/legendas de classificação; `PortalHome` passa a contar assimetrias em vez de classes Fraco/Regular.
7. **Compatibilidade de scores** — `scoringPremium.flexibilidade` e `bodyMapLogic.CLASS_SCORE` migram para percentil da base Fortem, com fallback numérico próprio (sem texto) quando n<15. `recomendacoesEngine` passa a disparar por faixa de assimetria/percentil.
8. **Suíte de testes** e revisão visual das três telas onde o BodyMap aparece.

## Riscos

- **Gravação legada**: mantenho `classifyAngle` gravando `leftClass/rightClass` no JSONB durante a transição (dado histórico + fallback), removendo da UI primeiro. Retirar da gravação é decisão separada.
- **Perda de fallback de score**: métricas com base Fortem insuficiente (n<15) hoje caem em `CLASS_SCORE`. Se removido cedo demais, alunos ficam com score nulo — por isso a etapa 7 vem depois da UI.
- **Sexo ausente no cadastro**: percentil e média Fortem exigem sexo; sem ele a coluna mostra "—".
- **Sem avaliação anterior**: primeira avaliação do aluno não tem delta — exibir "—".
- **Etapa 2 é global**: qualquer regressão de cor aparece nas três telas ao mesmo tempo; revisar as três antes de fechar.
- **PDF**: a remoção da coluna muda o layout do laudo já usado com clientes.

Nada foi alterado — este é só o diagnóstico e o plano.
