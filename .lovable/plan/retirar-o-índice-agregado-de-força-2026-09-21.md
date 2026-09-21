# Retirar o índice agregado de força

## Objetivo
Remover também a soma/média transformada em **score de Força**, mantendo os dados reais de dinamometria e as assimetrias por exercício.

## Alterações
- Retirar o cálculo agregado `forca` do resumo de resultados.
- Remover o anel `/100` de **Força** do Mapa Corporal.
- Remover a linha agregada **Força** do gráfico “Evolução no intervalo” do Comparativo.
- Manter as medições reais de cada exercício e lado em kg nas abas Força, Evolução e Comparativo.
- Manter as assimetrias de força, seus gráficos, contagens por faixa e alertas de risco/recomendações.
- Não alterar dados históricos, lançamentos, Kinology, BodyMapSVG ou regras de cálculo bilateral.

## Validação
- Conferir que nenhum score/média agregada de força aparece em Avaliações.
- Confirmar que valores E/D em kg e assimetrias de força continuam visíveis e corretos.
- Validar os modos Automático, Duas datas e Intervalo do Comparativo, além do Mapa Corporal.
