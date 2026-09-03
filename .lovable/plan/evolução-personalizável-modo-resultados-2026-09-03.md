# Evolução personalizável (modo Resultados)

Substituir a aba Evolução atual (gráfico único do "Índice Fortem") por uma visão configurável, onde o usuário escolhe as datas e exatamente quais dados quer acompanhar.

## O que muda

1. **Remover o Índice Fortem**: sai o gráfico com as linhas Índice/Mobilidade/Força/Composição e o cálculo `computePremiumScores` dessa aba.
2. **Painel de seleção** no topo da aba:
   - **Datas**: lista de todas as datas de avaliação do aluno com caixas de seleção (padrão: todas marcadas), com atalhos "Todas" / "Limpar".
   - **Tipos e itens**: cinco blocos com seleção múltipla e opção "todos":
     - Mobilidade — 6 métricas (Ombro RI, Ombro RE, Torácica, Quadril RI, Quadril RE, Tornozelo)
     - Flexibilidade — 3 métricas (Psoas, Quadríceps, Posterior de Coxa)
     - Força — exercícios de dinamometria lançados para o aluno
     - Composição — % gordura, peso, massa magra, massa gorda
     - Pliometria — salto vertical, salto horizontal, RSI, tempo de contato, potência, stiffness
   - Só aparecem itens que têm registro em pelo menos uma avaliação do aluno.
3. **Gráficos separados por tipo** (unidades diferentes não se misturam): um gráfico por categoria selecionada, na ordem Mobilidade, Flexibilidade, Força, Composição, Pliometria. Eixo X = datas selecionadas em ordem cronológica.
4. **Lados separados**: cada métrica com lateralidade gera duas linhas — "Nome (E)" e "Nome (D)" — com a mesma cor base e traço contínuo/tracejado para diferenciar.
5. **Timeline de avaliações** existente permanece abaixo dos gráficos.
6. **Estados vazios**: sem itens selecionados → mensagem pedindo seleção; menos de 2 datas com dado para o item → o gráfico ainda é exibido com os pontos disponíveis.

## Detalhes técnicos

- Arquivo principal: `src/components/avaliacoes-premium/tabs/EvolucaoTab.tsx`; painel de seleção extraído para `EvolucaoSeletor.tsx` na mesma pasta.
- Fonte de dados: `ConsolidadoAluno` já carregado (`funcional.history`, `composicao.history`, `pliometria.history`, `raw`) — nenhuma query nova, nenhum acesso ao banco alterado.
- Catálogo de métricas: `METRIC_META` / `getMetricDisplayLabel` (mobilidade x flexibilidade pelo campo `layer`) e `FORCA_EXERCICIO_LABEL` de `bodyMapLogic.ts`.
- Séries montadas por junção `data → valor`, com `connectNulls` no Recharts para datas sem registro daquela categoria.
- Cores das linhas a partir dos tokens do tema bio já usados na tela; nenhuma cor fixa nova.
- Sem mudanças em Lançamento, no mapa corporal, nas demais views de Resultados ou no backend.
