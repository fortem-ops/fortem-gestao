# Retirar Índice Fortem e médias agregadas das Avaliações

## Objetivo
Eliminar de toda a área de **Avaliações** os indicadores que somam ou transformam em média os valores de mobilidade e flexibilidade, incluindo o **Índice Fortem**.

## Alterações
- Remover o **Índice Fortem** e a linha agregada de **Mobilidade** do gráfico de intervalo no Comparativo.
- Retirar do motor de resultados os campos e cálculos de `indiceFortem`, média de mobilidade e média de flexibilidade.
- Remover esses valores agregados do vínculo com o mapa corporal, preservando o mapa, as medidas bilaterais, as assimetrias e as contagens por categoria.
- Manter os resultados reais já existentes: graus por exercício/lado, força em kg por exercício/lado, composição corporal, pliometria e gráficos de assimetria.
- Preservar as recomendações atuais baseadas em classificações individuais, assimetrias, composição e risco; elas não dependerão das médias removidas.

## Escopo técnico
- Ajustar `scoringPremium.ts`, `PremiumBodyMap.tsx` e `ComparativoTab.tsx` para remover as propriedades e referências aposentadas.
- Não alterar o banco, dados históricos, `BodyMapSVG`, critérios de classificação individual ou cálculos bilaterais de assimetria.
- Validar tipos, compilação e a ausência dos rótulos/linhas removidos em Evolução, Comparativo e Mapa Corporal.
