# Tonalidades clean/modern/futuristas no mapa corporal

## Objetivo
Refinar as cores verde (baixa assimetria), âmbar (assimetria moderada) e vermelho/coral (alta assimetria) usadas no mapa corporal e nos cards de Resultados para um visual mais clean, moderno e futurista, sem alterar a lógica de cálculo nem os limiares de 10% e 20%.

## Estado atual
- `corGradienteAssimetria` em `src/components/student/assessment/funcionalV2/bodyMapLogic.ts` já produz uma escala contínua suavizada (verde sálvia, âmbar, coral).
- As mesmas cores são consumidas por `BodyMapSVG.tsx`, `BodyMap.tsx` (legenda + anéis + badge de risco), `RegionListPanel.tsx`, `DashboardCountCard.tsx` e `DashboardScoreCard.tsx`.
- Os tokens globais `--sev-good`, `--sev-attention`, `--sev-weak` em `src/index.css` ainda usam tons mais saturados/convencionais e podem divergir do gradiente do mapa.

## O que será alterado

### 1. Paleta contínua mais clean/futurista
Em `bodyMapLogic.ts`, ajustar `corGradienteAssimetria` para:
- **Verde**: menta/sálvia frio, menos saturado e mais luminoso (hue ~155-160, sat ~32-38%, light ~58-64%).
- **Âmbar**: champagne/dourado suave, quase pastel (hue ~44-48, sat ~55-62%, light ~62-66%).
- **Vermelho**: coral-rosa futurista, menos agressivo (hue ~8-12, sat ~52-58%, light ~62-66%), evitando vermelho puro.
- Manter transição contínua e limiares 0–10%, 10–20%, 20%+.

### 2. Alinhar tokens globais de severidade
Em `src/index.css`, revisar `--sev-good`, `--sev-attention`, `--sev-weak` para combinarem com a nova paleta do mapa, mantendo contraste legível nos temas claro e escuro.

### 3. Ajustar legenda e anéis do mapa
Em `BodyMap.tsx`:
- `AsymmetryGradientLegend`: manter gradiente contínuo, mas deixar a barra um pouco mais alta e com borda sutil para reforçar o visual futurista.
- `ScoreRing` / badge de risco: passar a usar as cores derivadas de `corGradienteAssimetria` nos tons representativos (4%, 14%, 25%) para alinhar com o mapa.

### 4. Consistência nos cards de Resultados
Em `DashboardCountCard.tsx` e `DashboardScoreCard.tsx`, garantir que os tons de assimetria e severidade acompanhem a nova paleta (já usam `corGradienteAssimetria` e `--sev-*`, então a mudança será automática após os ajustes acima).

### 5. Validar sem regressões
- `bunx tsc --noEmit`
- `bun run build`
- Screenshot do mapa corporal no modo Resultados para confirmar que as novas tonalidades ficaram harmônicas e legíveis.

## Fora de escopo
- Limiares de assimetria (10% / 20%).
- Lógica de cálculo, animação `bodymap-breathe` ou `prefers-reduced-motion`.
- Outras telas que não usem as cores de severidade do body map.

## Riscos
- Mudança de cor global pode afetar gráficos de Evolução/Comparativo/Composição que usam `--sev-good` e `--sev-attention` para outras finalidades; por isso os tokens serão ajustados com cuidado para não perderem o significado semântico.
- Tema claro pode exigir leve ajuste de luminosidade para manter contraste; será verificado no screenshot.
