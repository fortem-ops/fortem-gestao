# Diagnóstico — Avaliações Premium (somente leitura)

## 1. Rótulo "Risco de Lesão" invisível — causa raiz

O rótulo está em `src/components/student/assessment/funcionalV2/BodyMap.tsx` (linha ~254), dentro da moldura do trio de anéis:

```
<p className="text-[9px] ... text-white/45 ...">Risco de Lesão</p>
<div className="rounded-xl border border-white/10 bg-white/[0.03] ...">
```

A tela Premium roda em tema claro via `[data-bio-theme="light"] .bodymap-surface` (`src/index.css`, linhas ~298-320). Esse bloco converte texto branco para tinta escura, mas a lista de seletores cobre apenas:

`.text-white`, `.text-white/40`, `.text-white/50`, `.text-white/55`, `.text-white/60`

`text-white/45` **não está na lista** — logo o rótulo continua branco quase puro sobre a superfície clara (`--bm-l-surface: 220 16% 93%`), ficando ilegível. Pelo mesmo motivo `bg-white/[0.03]` e `border-white/10` também não são convertidos (a lista de superfícies cobre `bg-white/5` etc.), por isso só a moldura aparece, difusa.

Correção futura (1 linha): usar uma opacidade já mapeada (`text-white/50`) ou incluir `/45` e `bg-white/[0.03]` nos overrides do tema claro.

## 2. Anel ">20%" mostrando 1 — não é bug de cálculo

Rastreamento: `BodyMap.tsx` → `rings.geral.alta` ← `assimetriasPorCategoria()` (`DashboardSummary.tsx` linha 35) → `contarAssimetriasPorFaixa([...mob, ...flex, ...forcaPcts])`. **Sim, o anel agrega Mobilidade + Flexibilidade + Força**, enquanto o painel "Pontos de Atenção" exibe só a camada selecionada (Força) — daí a impressão de contradição.

Dados reais do aluno AIRTON LUIZ MORAES JUNIOR (avaliação funcional_v2 mais recente, 05/08/2026, id `e6b04e1c…`):

- Força — maior assimetria: Abdução de quadril 13,2 / 15,4 kg = **14,29%** (moderada). Nenhuma acima de 20%. Confere com o painel.
- Mobilidade — **Mobilidade Tornozelo: 45 (E) vs 35 (D) → 22,2%** de diferença. É esta métrica que produz o `1` em `alta`.
- Mobilidade Quadril RE: 46 vs 40 → ~13% (moderada).

O próprio JSON salvo da avaliação já registra `asymmetries: [{region: "ankle-r", diff: 30, severity: "severe"}]`, coerente com a assimetria de tornozelo.

Sem NaN, sem duplicidade e sem resíduo antigo: existem 3 avaliações funcionais_v2 do Airton (2024-09-05, 2025-07-22, 2026-08-05) mais uma "experimental" de 31/08/2026, e `useAlunoAvaliacoesConsolidadas` usa apenas a mais recente ordenada por `data` — a de 05/08/2026, que é a fonte dos números acima.

**Conclusão:** o `1` está correto do ponto de vista do dado; o problema é de comunicação — o anel é agregado (geral) e o painel de atenção é por camada, sem nenhuma indicação disso na UI.

## Se quiser corrigir depois

- Bug 1: ajustar classe/override CSS do rótulo e da moldura para o tema claro.
- Bug 2 (opcional, UX): rotular o trio como agregado (ex.: "Risco de Lesão · todas as camadas") ou listar a métrica responsável ao passar o mouse.
