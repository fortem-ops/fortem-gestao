# Cores mais clean e formas pulsantes no mapa corporal

## Objetivo
Deixar a escala verde / amarelo / vermelho do mapa corporal mais suave e sofisticada, e fazer as formas musculares/articulares "respirarem" (ganhando e perdendo cor), no mesmo espírito das tonalidades vistas na camada "Tudo".

## O que muda

### 1. Paleta mais clean
Ajustar a escala contínua de assimetria (`corGradienteAssimetria`):
- Verde: tom levemente mais frio e dessaturado (saturação ~38-45%, luminosidade ~52-56%) — aspecto sálvia/menta em vez de verde vivo.
- Amarelo: virar para âmbar suave (saturação ~62-70%, luminosidade ~58-62%) — sem o amarelo neon atual.
- Vermelho: coral dessaturado (saturação ~55-62%, luminosidade ~56-60%) — mantém a leitura de risco sem agressividade.
A transição contínua entre as faixas continua igual; só as constantes de saturação/luminosidade ficam mais baixas/mais claras.

### 2. Formas pulsantes
- Nova animação de respiro (`bodymap-breathe`) no CSS global: variação apenas de opacidade (ex.: 0.55 → 0.9 → 0.55) em ciclo lento (~3,2s), sem escala, para não deslocar os contornos anatômicos.
- Aplicar essa animação nos preenchimentos das formas de Mobilidade (articulações), Força e Flexibilidade, com um pequeno atraso variável por forma para que não pulsem todas em uníssono.
- Intensidade do respiro proporcional à severidade: formas neutras/cinza ficam praticamente estáticas; formas com maior assimetria pulsam com mais amplitude.
- Respeitar `prefers-reduced-motion`: sem animação para quem pediu movimento reduzido.

## Detalhes técnicos
- `src/components/student/assessment/funcionalV2/bodyMapLogic.ts` — ajuste dos valores de hue/sat/light em `corGradienteAssimetria`.
- `src/index.css` — keyframes `bodymap-breathe` + classes utilitárias (amplitude normal e suave) e bloco `prefers-reduced-motion`.
- `src/components/student/assessment/funcionalV2/BodyMapSVG.tsx` — aplicar a classe de respiro em `MuscleShapeFill` e `ArticulationShapeFill`, com `animation-delay` derivado do índice/chave da forma e amplitude escolhida pela severidade.
- Sem mudanças em dados, lógica de cálculo ou no modo Lançamento.
