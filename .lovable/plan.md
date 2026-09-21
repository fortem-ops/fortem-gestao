# Correções do portal e da nomenclatura

## Resultado
- Restaurar no portal o aviso de reavaliação, a composição corporal e o histórico simples de avaliações.
- Diferenciar claramente dinamometria de mobilidade/flexibilidade, inclusive em nomes, selos, agrupamentos e resumo.
- Simplificar a comparação com a base e devolver a camada “Tudo” ao mapa.
- Unificar a classificação de força no corte exato de 20% e ajustar as frases geradas.

## Implementação
1. Recuperar a lógica anterior de prazo de quatro meses e os dados já disponíveis de composição e histórico, adaptando-os aos cartões recolhidos atuais.
2. Usar `FORCA_EXERCICIO_LABEL` como fonte única dos nomes de força; expor agrupamentos por camada na lógica pura para permitir teste sem depender da renderização.
3. Remover apenas o texto de percentil das curvas e adicionar “Tudo” ao seletor do mapa, mantendo desenho, marcadores, valores e média.
4. Substituir limiares locais da força por `nivelAssimetria` tanto na aba Força quanto na lista do mapa; manter cores e rótulos centralizados.
5. Reescrever as frases de recomendações e pontuação para “no nível Atenção/Prioridade”.
6. Adicionar testes para distinção/agrupamento da força e para 20% exatos, sem alterar regras para acomodar falhas.

## Validação
- Executar o typecheck e a suíte completa.
- Conferir o estado final do preview e listar literalmente resultados e arquivos tocados.

## Limites
- Nenhuma alteração em cortes, motor clínico, telas fora das citadas ou visualizador funcional antigo.
- O histórico restaurado exibirá somente tipo e data.
