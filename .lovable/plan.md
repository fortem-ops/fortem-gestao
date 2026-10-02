# Repaginar PDF Power to the People

## Implementação
- Manter a página 1 exclusivamente com cabeçalho, observações, aquecimento e frequência lateral.
- Usar toda a largura útil da página 2, sem reservar espaço para frequência.
- Redimensionar as duas progressões lado a lado para abrir espaço vertical suficiente.
- Posicionar a Regra da Rampa logo abaixo das progressões.
- Renderizar os Treinos 1–4 auxiliares abaixo da regra, continuando em página adicional somente se o conteúdo real exceder a folha.

## Validação
- Gerar o PDF real de teste do PTTP e inspecionar visualmente todas as páginas.
- Rodar o typecheck e consultar o diff disponível no ambiente.
