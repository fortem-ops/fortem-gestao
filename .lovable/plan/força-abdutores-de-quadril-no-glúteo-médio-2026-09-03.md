# Força: Abdutores de Quadril no Glúteo Médio

Hoje, na camada Força do mapa corporal, tanto "Abdução de Quadril" quanto "Extensão de Quadril" pintam a mesma região (Glúteo). As formas `gluteo-medio-direito` e `gluteo-medio-esquerdo` já existem calibradas em Config. Mapa Corporal, mas nenhum movimento aponta para elas.

## Mudança

- Abdução de Quadril passa a destacar Glúteo Médio (`gluteo-medio-direito` / `gluteo-medio-esquerdo`).
- Extensão de Quadril continua destacando Glúteo (`gluteo-direito` / `gluteo-esquerdo`).

## Detalhe técnico

Em `src/components/student/assessment/funcionalV2/shapeMuscleMapping.ts`, alterar em `FORCA_SHAPE_MUSCLE` a entrada `abducao_quadril` de `"gluteo"` para `"gluteo-medio"`. Nenhuma alteração de banco ou de outras camadas (Mobilidade/Flexibilidade) é necessária.
