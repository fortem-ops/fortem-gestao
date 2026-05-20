# Mapa Corporal Biomecânico FORTEM — como Segunda Avaliação Funcional (paralela)

Para não impactar a Avaliação Funcional atual em produção, o redesign será entregue como um **novo tipo de avaliação paralelo**, coexistindo com o existente. A unificação acontece em fase posterior, após validação.

## Estratégia de coexistência

- Tipo atual `funcional` permanece intacto (telas, dados, PDF, BodyDiagram antigo) — zero alteração.
- Novo tipo `funcional_v2` (rótulo na UI: **"Avaliação Funcional (Nova)"** ou **"Avaliação Biomecânica"**) com seu próprio fluxo de criação, visualização e Mapa Corporal premium.
- Ambos aparecem na lista de avaliações do aluno, diferenciados por badge.
- Migração/unificação fica para etapa futura — sem conversão automática de dados.

## Backend (mínimo, não destrutivo)

- Registrar o novo tipo em `avaliacao_tipos` (`slug='funcional_v2'`, `nome='Avaliação Funcional (Nova)'`, `engine='funcional_v2'`, `ativo=true`).
- **Sem nova tabela**: reaproveitar `avaliacoes.dados` (jsonb) com a mesma estrutura de `metricas[]` já usada hoje, mais campos opcionais (`score`, `scoreMobilidade`, `scoreSimetria`, `scoreEstabilidade`, `assimetrias[]`, `riscos[]`, `cadeias[]`) calculados no cliente e persistidos para o PDF/portal.
- Sem tocar em `avaliacao_funcional` (tabela tipada antiga).
- Migração apenas insere a linha em `avaliacao_tipos`. RLS já cobre.

## Frontend — novos arquivos

Diretório novo: `src/components/student/assessment/funcionalV2/`

- `FuncionalV2Form.tsx` — formulário de coleta (mesmas métricas atuais + campos opcionais novos: dor 0-10 por região, força bilateral). Salva em `avaliacoes` com `tipo='funcional_v2'`.
- `FuncionalV2Viewer.tsx` — visualização completa (substitui o conteúdo do dialog para este tipo).
- `bodymap/BodyMapSVG.tsx` — silhueta anatômica inline (anterior + posterior), regiões como `<g>` independentes.
- `bodymap/BodyMapRegion.tsx` — região com halo/glow + tooltip.
- `bodymap/BodyMapHeader.tsx` — Índice Funcional FORTEM (score geral + sub-scores).
- `bodymap/BodyMapControls.tsx` — alternância de Modo (Qualidade / Assimetria / Risco) e Camada (Mobilidade / Flexibilidade / Dor / Força / Assimetria).
- `bodymap/BodyMapLegend.tsx` — legenda dinâmica por modo.
- `bodymap/bodyMapLogic.ts` — mapeamento métrica→região, cálculo de score, assimetria, risco, cadeias compensatórias.

Tokens novos em `src/index.css`:
- `--severity-excellent | good | medium | attention | weak` (HSL) + variantes `--glow-*`.
- `--bodymap-bg`, `--bodymap-silhouette`, `--bodymap-grid`.

## Integração com telas existentes (alterações cirúrgicas)

- `AssessmentViewerDialog.tsx`: adicionar branch `if (avaliacao.tipo === 'funcional_v2') return <FuncionalV2Viewer .../>` antes dos branches atuais. Nada mais muda.
- `src/pages/Avaliacoes.tsx` (ou diálogo de criação equivalente): no seletor de tipo, listar `funcional_v2` como opção adicional, mostrando badge "Nova" — o tipo antigo `funcional` continua disponível.
- `StudentAssessments.tsx`: aceitar `funcional_v2` no listing (já é genérico via `a.tipo`).
- Portal do aluno (`PortalAssessments.tsx`): adicionar rótulo no `tipoLabel` para `funcional_v2`.
- PDF: por ora, exportar como snapshot textual simples (placeholder), redesign do PDF fica para a unificação.

## Especificação visual (resumida — detalhe completo no plano anterior)

- SVG vetorial inline em dark mode, halos/glow proporcionais à severidade, pontos articulares pulsantes, linhas biomecânicas tracejadas para cadeias compensatórias.
- 3 modos: Qualidade Geral, Assimetria Corporal, Risco Funcional.
- 5 camadas: Mobilidade, Flexibilidade, Dor, Força, Assimetria.
- Índice Funcional FORTEM no topo (score 0–100 + sub-scores).
- Tooltips com métrica/lado/valor/classificação/interpretação.
- Sem novas dependências; transições via Tailwind + key remount.
- Responsivo desktop/tablet/mobile (vistas empilham, tap-target ≥ 32px, pinch-zoom).

## Plano de unificação (fase futura, fora deste escopo)

1. Validar `funcional_v2` em produção com casos reais.
2. Script de migração de `avaliacao_funcional` (tabela tipada) → `avaliacoes.dados` no formato v2.
3. Marcar tipo `funcional` como `ativo=false` no seletor.
4. Renomear `funcional_v2` → `funcional`.
5. Remover `BodyDiagram` antigo, asset `corpo-humano.svg` e tabela `avaliacao_funcional`.

## Plano de entrega desta fase

1. Migração: inserir tipo `funcional_v2` em `avaliacao_tipos`.
2. Tokens semânticos + utilitários em `index.css`.
3. `bodyMapLogic.ts` (mapeamentos, score, assimetria, risco, cadeias).
4. `BodyMapSVG.tsx` + componentes do bodymap.
5. `FuncionalV2Viewer.tsx` + `FuncionalV2Form.tsx`.
6. Branch em `AssessmentViewerDialog` e opção no diálogo de criação.
7. Ajustes mínimos em listings e portal.
8. QA visual desktop/mobile e validação dos cálculos com dados reais.
