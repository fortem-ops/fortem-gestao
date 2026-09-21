# Identificar cada exercício nos gráficos de assimetria

## Objetivo
Tornar cada exercício/métrica imediatamente reconhecível nos gráficos de assimetria, sem depender apenas das atuais cores amarela e verde.

## Alterações
- Criar uma paleta compartilhada e variada para assimetrias, com uma cor estável por exercício/métrica.
- Aplicar a mesma associação de cor nas abas **Evolução** e **Comparativo**, para que um exercício mantenha sua identidade visual entre os gráficos.
- No gráfico **Assimetrias no intervalo**, substituir a alternância fixa amarelo/verde pelas cores individuais e manter a legenda com o nome correspondente.
- Preservar a diferenciação por traço para métricas em graus, sem alterar cálculos, dados ou demais gráficos.
- Conferir legibilidade da legenda e das linhas no tema atual, incluindo a visualização desta avaliação.

## Detalhes técnicos
- Centralizar a seleção de cores no helper de assimetrias, evitando regras divergentes entre as duas abas.
- Usar os tokens visuais existentes do projeto e garantir repetição determinística quando houver mais séries que cores disponíveis.
- Validar compilação e o resultado visual no gráfico de intervalo com vários exercícios simultâneos.
