## Objetivo
Trocar as silhuetas vetoriais atuais (`AnatomyFront`/`AnatomyBack`) pela imagem `fortem_anatomia` enviada, mantendo halos, tooltips, assimetrias e cadeias compensatórias funcionando por cima.

## Premissas
- A imagem é um PNG embutido em SVG (~1536×1024) mostrando vista **anterior + posterior lado a lado**.
- Sem paths por músculo → não é possível `clip-path` por contorno anatômico. Halos passam a ser **círculos com gradiente radial** posicionados sobre cada região (volta ao modelo Whoop/Oura, ainda premium).
- Toda a lógica de `bodyMapLogic.ts`, scores, severidades, modos (Qualidade/Assimetria/Risco) e cadeias **fica intacta**.

## Passos

1. **Extrair e otimizar a imagem**
   - Decodificar o base64 do SVG enviado → PNG.
   - Recortar em duas metades (anterior / posterior) e salvar:
     - `src/assets/bodymap/anatomy-front.png`
     - `src/assets/bodymap/anatomy-back.png`
   - Redimensionar para ~600×800 cada, qualidade alta, fundo transparente se possível (senão fundo escuro casando com `--bodymap-surface`).

2. **Refatorar `AnatomyFront.tsx` / `AnatomyBack.tsx`**
   - Substituir todos os `<path>` por um único `<image href={anatomyFront} ... />` ocupando o viewBox.
   - Remover defs de gradientes corporais (sombreamento já vem da foto).
   - Manter o mesmo viewBox `0 0 200 540` para não quebrar coordenadas existentes.

3. **Ajustar `BodyMapSVG.tsx`**
   - Remover `<clipPath>` que referenciam `#region-*` (não existem mais).
   - `RegionGlow` passa a renderizar apenas:
     - halo externo (radialGradient suave)
     - núcleo brilhante central
     - anel luminoso fino (`<circle>` com stroke colorido)
   - Recalibrar `REGION_GEOMETRY` (cx/cy/r) para casar com as posições reais dos músculos na nova imagem — uma rodada de ajuste visual após inserir o asset.

4. **Tokens CSS (`src/index.css`)**
   - Manter `--bodymap-surface` e cores de severidade.
   - Remover/limpar tokens não usados (`--bodymap-muscle-base`, `--bodymap-line` etc.) ou deixar como fallback.

5. **QA**
   - Validar que halos ficam centrados nos músculos corretos em ambas as vistas.
   - Tooltips, linhas de assimetria e cadeias compensatórias continuam funcionando.
   - Conferir contraste no dark mode e que a imagem não estoura o card.

## Arquivos
**Criados:** `src/assets/bodymap/anatomy-front.png`, `anatomy-back.png`
**Editados:** `src/components/student/assessment/funcionalV2/anatomy/AnatomyFront.tsx`, `AnatomyBack.tsx`, `src/components/student/assessment/funcionalV2/BodyMapSVG.tsx`, `src/index.css`

## Fora de escopo
- `bodyMapLogic.ts`, formulário, viewer, PDF, banco de dados.

## Observação
Se mais tarde você quiser voltar ao efeito de "preenchimento por contorno do músculo" (clip-path Biomech), precisaremos de um SVG vetorial verdadeiro com `<path>` por região — a imagem raster não permite isso.
