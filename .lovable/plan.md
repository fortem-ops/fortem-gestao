
## Mapa Corporal — sem corte das mãos + layout estilo referência

### 1. Mãos cortadas

A causa é o asset PNG anatômico (`anatomy-front.png` / `anatomy-back.png`), gerado com pouco espaço lateral e renderizado em `width=360` para preencher o viewBox `360×800`. Quando o aluno está em postura natural, as pontas dos dedos ficam fora da tela.

Solução em duas frentes (juntas):

- **Regenerar os PNGs** (anterior e posterior) com mais respiro lateral (corpo centralizado ocupando ~70% da largura) e proporção 9:16 — mesmo personagem/iluminação para manter consistência visual.
- **Ajustar o `<image>` dentro do SVG** para deixar o corpo um pouco menor e centralizado: renderizar em `x=18, width=324` (em vez de `x=0, width=360`), mantendo o viewBox `360×800`. Isso garante margem mesmo se a regeneração trouxer alguma variação.
- **Recalibrar coordenadas**: como o corpo fica ~10% menor e levemente deslocado, atualizar `REGION_GEOMETRY` (12 pontos) no `BodyMapSVG.tsx` para acompanhar. Admin pode refinar depois pelo modo Calibração já existente.

### 2. Novo layout (referência: card "MAPA CORPORAL" da imagem anexa)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ MAPA CORPORAL                              [ Anterior | Posterior ]  │
│ ┌──────────┬────────────────┐  ┌────────────────────────────────┐    │
│ │ QUALIDADE│ ASSIM. │ RISCO │  │ ● Excelente ● Bom ● Atenção ●…│    │
│ └──────────┴────────────────┘  └────────────────────────────────┘    │
│                                                                      │
│ ┌──────────────┬──────────────┐  ┌──────────────────────────────┐    │
│ │              │              │  │ ① Tornozelo (D)        22%   │    │
│ │   ANTERIOR   │  POSTERIOR   │  │    Dorsiflexão  Déficit mob. │    │
│ │   (com ①②③…)│ (com ④⑤⑥…)  │  │ ② Ombro (E)            17%   │    │
│ │              │              │  │    Rotação interna  Assim.   │    │
│ │              │              │  │ ③ Quadríceps (D)       36%   │    │
│ │              │              │  │    Extensão joelho  Elevada  │    │
│ │              │              │  │ … (até 6 itens)              │    │
│ └──────────────┴──────────────┘  └──────────────────────────────┘    │
│ Texto explicativo: "As porcentagens representam diferença…"          │
└──────────────────────────────────────────────────────────────────────┘
```

Mudanças visuais:

- **Numeração nos pontos**: cada região com severidade ≠ `none` ganha um marcador circular numerado (1, 2, 3…) sobreposto ao halo (fundo escuro com borda colorida pela severidade). Numeração ordenada por gravidade (weak → attention → medium → good → excellent).
- **Painel lateral à direita do mapa** (em telas ≥ md): lista das mesmas regiões com:
  - número + nome da região + sub-rótulo (métrica principal que ficou pior, ex.: "Dorsiflexão")
  - badge de % à direita (assimetria quando houver, senão `100 − score`)
  - linha inferior com classificação (`Déficit de mobilidade`, `Assimetria moderada`, `Equilibrado`)
- **Toggle Anterior/Posterior no topo do card**: além do modo "ambos lado a lado" atual, adicionar dois botões `Anterior | Posterior` que destacam/ampliam uma vista. Default `ambos` em telas grandes; em mobile, padrão = `Anterior` com toggle.
- **Legenda de severidade** movida para o topo direito (junto ao toggle), inline horizontal com pontinhos coloridos — mesmas 5 cores (`excellent…weak`).
- **Texto-rodapé** discreto: "As porcentagens representam a diferença do lado avaliado em relação ao lado mais forte ou ao valor de referência."

### Escopo técnico

- **Assets** (`src/assets/bodymap/anatomy-front.png`, `anatomy-back.png`): regenerar via `imagegen` com prompt ajustado para incluir mãos completas, proporção 9:16, fundo neutro.
- **`AnatomyFront.tsx` / `AnatomyBack.tsx`**: trocar `x=0 width=360` por `x=18 width=324` (centraliza e dá margem).
- **`BodyMapSVG.tsx`**:
  - Recalibrar `REGION_GEOMETRY` para a nova escala.
  - Novo componente `RegionNumber` desenhado em cima do halo (círculo + texto).
  - Aceitar prop `numbering: Record<RegionId, number>` para sincronizar com o painel.
  - Adicionar suporte a `viewFilter?: "front" | "back" | "both"`.
- **`BodyMap.tsx`**:
  - Novo estado `viewFilter`.
  - Calcular lista ordenada por gravidade e gerar mapa `regionId → número`.
  - Renderizar grid: mapa SVG à esquerda, painel `RegionListPanel` (novo subcomponente) à direita.
  - Mover legenda para o topo.

### Fora de escopo

- Não alterar lógica de análise (`bodyMapLogic.ts`), métricas, formulário, viewer, PDF.
- Não mexer no modo Calibração (já funciona com novas coordenadas).
- Não trocar paleta nem tipografia.
