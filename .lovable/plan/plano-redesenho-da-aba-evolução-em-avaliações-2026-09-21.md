# Plano — redesenho da aba Evolução em Avaliações

## Escopo
- Alterar somente a aba **Evolução** dentro de Avaliações → Resultados.
- Não alterar limiares, classificação, motor de assimetria, dados históricos, mapa corporal ou outras abas.
- Manter o seletor de datas existente e a funcionalidade atual de evolução dos valores, movendo-a para um bloco recolhido abaixo dos novos mini-gráficos.

## Implementação
1. Criar funções puras para a nova leitura de assimetrias:
   - montar séries por tipo: mobilidade/flexibilidade ou força;
   - calcular valor, unidade e faixa usando `classificarAssimetria()` / `nivelAssimetria()`;
   - identificar lado mais fraco respeitando `metricaInvertida()`;
   - detectar inversão do lado mais fraco;
   - calcular tendência com corte de 1 pp para percentuais e 0,5° para Psoas;
   - ordenar métricas por severidade atual e razão contra o corte severo da própria métrica.

2. Redesenhar a parte superior da aba Evolução:
   - botões “Mobilidade e flexibilidade” e “Força (dinamometria)”;
   - interruptor “Só fora da faixa verde” desligado por padrão;
   - manter chips de datas Todas/Limpar.

3. Adicionar os três números-resumo:
   - fora da faixa verde na última avaliação;
   - pioraram entre primeira e última data selecionada;
   - trocaram o lado mais fraco.
   - Incluir legenda das faixas e, em mobilidade/flexibilidade, nota do Psoas em graus com cortes 3° e 5°.

4. Criar a tabela-resumo:
   - métrica;
   - primeira e quatro últimas datas quando houver mais de 5 datas selecionadas;
   - valores em selos coloridos pela faixa;
   - variação, tendência, faixa atual e lado mais fraco;
   - selo “inverteu” quando aplicável.

5. Criar a grade de mini-gráficos:
   - 3 colunas em telas amplas;
   - um card por métrica, na mesma ordem da tabela;
   - fundo com três faixas usando os limiares vindos das constantes do motor;
   - Psoas em eixo próprio até 8° ou maior valor; demais até 30% ou maior valor;
   - eixo X proporcional ao tempo real;
   - segmentos retos, sem suavização;
   - tooltip de ponto único;
   - marco de protocolo por constante inicialmente vazia.

6. Estados especiais:
   - sem avaliação: preservar o estado vazio atual;
   - uma avaliação: mostrar mensagem curta e retrato das assimetrias daquela avaliação, sem gráfico.

7. Testes e validação:
   - adicionar testes puros para lado mais fraco, exceção invertida, inversão, tendência e ordenação;
   - rodar typecheck;
   - rodar a suíte completa;
   - validar visualmente a aba Evolução no preview.

## Arquivos previstos
- `src/components/avaliacoes-premium/assimetriaGrafico.ts`
- `src/components/avaliacoes-premium/tabs/EvolucaoTab.tsx`
- `src/test/avaliacaoMotor.test.ts` ou novo teste puro equivalente
