# Ajuste do Mapa Corporal — mãos cortadas + calibração anatômica

## Diagnóstico

A imagem anatômica atual (`anatomy-front.png` / `anatomy-back.png`) foi trimmed/centralizada em **300×800**, mas o corpo masculino com braços em posição neutra ocupa quase toda a largura — as **mãos ficam encostadas nas bordas laterais** e visualmente parecem cortadas. O `viewBox` do `<svg>` também é 300×800, então não há margem onde respirar.

O SVG de referência enviado (`fortem_masculino_paths_anatomicos_editaveis.svg`) usa proporção mais larga (~440×900 por vista) justamente para acomodar braços e mãos.

## O que muda

### 1. Re-processar as imagens base com padding lateral
- Recortar de novo `anatomy-front.png` e `anatomy-back.png` para **360×800** (mantendo o corpo centralizado), adicionando ~30px de margem em cada lado.
- Garante que mãos, dedos e cotovelos fiquem inteiros e com folga visual.

### 2. Atualizar `AnatomyFront.tsx` / `AnatomyBack.tsx`
- Trocar `width="300"` por `width="360"`.

### 3. Atualizar `BodyMapSVG.tsx`
- `VIEWBOX = { w: 360, h: 800 }`.
- Recalibrar `REGION_GEOMETRY` para o novo enquadramento, usando o SVG anatômico de referência como guia de posicionamento dos grupos musculares (ombros, trapézio, peitoral/torácica, lombar, glúteo, quadríceps, isquiotibiais, gastrocnêmio/tornozelo).
- Os halos continuam sendo o `RegionGlow` atual (gradiente radial + anel luminoso + núcleo) — visual não muda, só posição.

### 4. Container
- Ajustar `max-w-[300px]` → `max-w-[360px]` no wrapper de cada vista.

## Fora do escopo

- Não migrar para SVG vetorial com path por músculo (a referência é só guia visual de posição — a visualização final permanece a imagem raster já estabelecida).
- Não mexer em `bodyMapLogic.ts`, formulário, viewer ou PDF.
- Cores, severidades, tooltips, cadeias compensatórias e linhas de assimetria permanecem idênticos.

## Resultado esperado

Mãos e braços inteiros, com pequena margem lateral, e halos centralizados corretamente sobre cada grupo muscular real da imagem anatômica.
