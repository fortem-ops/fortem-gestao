# Pulsação simultânea no Mapa Corporal

Hoje cada forma do mapa recebe um atraso diferente na animação de respiração (delay derivado da chave da forma), então os lados e pontos pulsam fora de sincronia.

## Ajuste
- Remover o atraso individual das formas para que todas iniciem no mesmo instante.
- Manter a mesma duração e curva de animação atuais, e as intensidades diferentes (suave para áreas neutras, forte para áreas com alerta) — só a fase passa a ser comum.
- Comportamento com `prefers-reduced-motion` continua igual (sem animação).

## Detalhes técnicos
- `src/components/student/assessment/funcionalV2/BodyMapSVG.tsx`: eliminar a função `breatheDelay` e o `style={{ animationDelay: ... }}` aplicado nas formas e grupos.
- `src/index.css`: nenhuma mudança necessária (`bodymap-breathe` já é global e de mesma duração).

## Riscos
Baixo: alteração puramente visual, sem impacto em cálculos, cores ou dados.
