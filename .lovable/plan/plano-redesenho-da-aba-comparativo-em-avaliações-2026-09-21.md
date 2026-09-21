# Plano — Redesenho da aba Comparativo em Avaliações

## Escopo
- Alterar somente a aba **Comparativo** em Avaliações → Resultados.
- Remover as assimetrias da aba Comparativo.
- Preservar limiares, classificação, motor de assimetria e demais abas.
- Manter seções existentes além de Mobilidade/Flexibilidade e Força, informando ao final quais permaneceram.

## Implementação
1. **Comparativo passa a focar em valores**
   - Cabeçalho com título “Comparativo de valores”.
   - Mostrar datas comparadas e intervalo em meses.
   - Manter o seletor de modo atual sem mudar comportamento.
   - Para modo com uma avaliação só, manter o estado atual.

2. **Remover assimetrias do Comparativo**
   - Remover o gráfico de barras “Assimetrias”.
   - Remover o gráfico “Assimetrias no intervalo”.
   - Remover imports e cálculos usados apenas por esses gráficos.
   - Manter Evolução como o lugar para comparação de assimetrias.

3. **Adicionar quatro números-resumo**
   - Lados que subiram de faixa em mobilidade/flexibilidade.
   - Lados que caíram de faixa em mobilidade/flexibilidade.
   - Lados que ganharam força.
   - Lados que perderam força.
   - Não contar lados sem valor em uma das datas.

4. **Aviso com atalho para Evolução**
   - Inserir uma faixa curta informando que diferenças entre lados estão na aba Evolução.
   - Botão/link troca para a aba Evolução.

5. **Nova tabela de mobilidade e flexibilidade**
   - Uma linha por métrica, juntando esquerdo e direito.
   - Colunas: métrica, esquerdo, direito, faixa.
   - Cada lado mostra valor/classificação antes → valor/classificação depois + variação em graus.
   - Classificação via `classifyAngle()`.
   - Comparação de faixa na ordem Fraco < Regular < Médio < Bom < Excelente.
   - Variação respeita `metricaInvertida()` para cor de melhora/piora.
   - Ordenação: caiu, subiu, sem mudança; depois ordem canônica.
   - Remover “Nº métricas registradas”.

6. **Nova tabela de força**
   - Uma linha por exercício.
   - Nome pelo rótulo legível de `FORCA_EXERCICIO_LABEL`.
   - Colunas: exercício, esquerdo, direito, resumo.
   - Cada lado mostra kg antes → kg depois + variação percentual do valor anterior.
   - Criar constante provisória de estabilidade de força em 5%, com comentário clínico.
   - Resumo: perdeu força, ganhou força, estável.
   - Ordenação: perdeu, ganhou, estável.
   - Nota abaixo da tabela explicando o corte provisório de 5%.

7. **Testes puros**
   - Movimento de faixa: subiu/caiu/igual.
   - Cor da variação em métrica comum e invertida.
   - Variação percentual de força com corte de 5%, incluindo exatamente 5% e logo abaixo.
   - Ordenação de mobilidade/flexibilidade.
   - Ordenação de força.

## Validação
- Rodar typecheck.
- Rodar suíte completa.
- Reportar resultados literais com número de testes executados.
- Listar arquivos tocados e o que mudou em cada um.
