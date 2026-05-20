# Anatomia Biomecânica Premium — Mapa Corporal v2

## Objetivo
Substituir a silhueta atual (formas geométricas simples em `BodyMapSVG.tsx`) por um corpo humano anatômico realista em SVG vetorial, estilo Instituto Biomech / Kinology / BioDigital — monocromático, técnico, premium — mantendo toda a lógica de regiões, halos, tooltips e modos já existente.

## Escopo
Apenas frontend / presentação. Sem mudanças em:
- `bodyMapLogic.ts` (lógica, scores, cadeias)
- `BodyMap.tsx` (header, controles, legenda)
- Banco de dados, formulário, viewer, PDF

## Mudanças

### 1. Novo asset anatômico — `src/components/student/assessment/funcionalV2/anatomy/`
Criar dois arquivos SVG inline como componentes React (não PNG, não asset externo):

- `AnatomyFront.tsx` — vista anterior
- `AnatomyBack.tsx`  — vista posterior

Características:
- Paths anatômicos realistas (não primitivas ellipse/rect): deltoides, peitoral, reto abdominal, oblíquos, quadríceps (vasto lateral/medial/reto femoral), adutores, tibial anterior, posterior de coxa (isquiotibiais), glúteo máx/médio, gastrocnêmio, trapézio, latíssimo, eretores espinhais, romboides.
- Cada músculo/região é um `<path>` com `id` e `data-region` correspondente aos `RegionId` de `bodyMapLogic.ts` (`shoulder-l`, `quad-r`, `ham-l`, `glute-l/r`, `thoracic`, `lumbar`, `hip-l/r`, `ankle-l/r`, `knee-l/r`).
- Acabamento monocromático: fill com `hsl(var(--bodymap-muscle))` em camadas (base escura + sombreamento via paths translúcidos sobrepostos para dar volume anatômico, sem usar imagem raster).
- Linhas técnicas finas (`stroke` 0.4–0.6) em `hsl(var(--bodymap-line) / 0.4)` para insertion lines musculares.
- ViewBox padronizado `0 0 220 580`.

### 2. Tokens visuais — `src/index.css`
Adicionar/ajustar variáveis dentro de `.bodymap-surface`:
```
--bodymap-bg-grad-1, --bodymap-bg-grad-2      /* fundo escuro com gradiente sutil */
--bodymap-muscle-base   : 220 8% 18%          /* cinza neutro do músculo */
--bodymap-muscle-shade  : 220 10% 12%         /* sombreamento */
--bodymap-muscle-hi     : 220 6% 30%          /* highlight anatômico */
--bodymap-line          : 220 10% 55%         /* contorno técnico */
--bodymap-silhouette    : 220 8% 22%          /* fallback */
```
Tons cinza-azulado frio, baixo contraste, leitura "clínica esportiva".

### 3. Sobreposição de halos
- `REGION_GEOMETRY` em `BodyMapSVG.tsx` é mantido (cx/cy/r por região) e usado como ponto de luz radial sobre o músculo correspondente.
- Halos atuais (radialGradient + pulse) são preservados — apenas passam a brilhar **sobre** a anatomia realista, não sobre formas primitivas.
- Adicionar máscara opcional: o glow do halo é clipado pelo `<path>` do músculo via `<clipPath id="region-{id}">`, garantindo que o brilho siga o contorno muscular (efeito Biomech).
- Regiões não destacadas permanecem em `--bodymap-muscle-base` com opacidade reduzida (~0.55), reforçando o foco visual nas áreas avaliadas.

### 4. Refatoração de `BodyMapSVG.tsx`
- Remover `HumanSilhouette` (primitivas).
- Importar `<AnatomyFront />` / `<AnatomyBack />`.
- Para cada região, renderizar:
  1. Path anatômico (vem do componente Anatomy)
  2. `<use href="#region-{id}" />` com filtro de glow quando severity ≠ none
  3. Halo radial sobre o centro (como hoje)
  4. Hitbox transparente para Tooltip
- Mapear regiões anatômicas extra à lógica existente (glúteo máx → `glute-l/r` se não existir no logic, adicionamos só o mapeamento visual — sem mudar scores).

### 5. Detalhes técnicos premium
- Gradiente linear sutil no fundo do card (`radial-gradient` central) para profundidade.
- Linha vertebral central (vista posterior) com pontilhado fino já existente — mantida e refinada.
- Marcações de eixo bilateral (linha horizontal de ombro e quadril) opcional, em opacidade 0.1.
- Animação `bodymap-pulse` mantida.

## Out of scope
- Não alterar lógica de cálculo de scores nem regras de assimetria/cadeias.
- Não trocar tooltips nem controles.
- Não adicionar zoom/pan (pode entrar em iteração futura).

## Arquivos
**Criados**
- `src/components/student/assessment/funcionalV2/anatomy/AnatomyFront.tsx`
- `src/components/student/assessment/funcionalV2/anatomy/AnatomyBack.tsx`

**Editados**
- `src/components/student/assessment/funcionalV2/BodyMapSVG.tsx`
- `src/index.css` (tokens `--bodymap-*`)

## Riscos
- SVG anatômico realista feito 100% à mão fica ~300–500 linhas por vista. Ainda assim é o caminho correto pedido (sem PNG, sem cartoon). Os PDFs anexados (Kinology / Biomech) são referência visual — não serão importados, mas a paleta e o nível de detalhe muscular do componente serão alinhados a eles.
