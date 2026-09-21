# Plano — Gráfico comparativo de assimetrias

## Objetivo
Adicionar um gráfico de assimetrias nas áreas de **Evolução** e **Comparativo**, para visualizar a mudança das diferenças entre lado esquerdo e direito ao longo do tempo e entre duas avaliações.

## O que será feito
1. **Criar uma base única de cálculo de assimetria para gráficos**
   - Reaproveitar a regra já existente do motor de avaliação:
     - Psoas por diferença absoluta em graus.
     - Demais mobilidade/flexibilidade por percentual entre lados.
     - Força por percentual entre lados.
   - Ignorar métricas sem os dois lados preenchidos.

2. **Adicionar o gráfico em Evolução**
   - Incluir um novo grupo selecionável chamado **Assimetrias** no seletor de dados da aba Evolução.
   - Mostrar linhas por métrica/exercício com o valor da assimetria por data.
   - Exibir unidade adequada no nome/tooltip:
     - `%` para assimetrias percentuais.
     - `°` para Psoas.
   - Manter os filtros de datas e itens já existentes.

3. **Adicionar o gráfico em Comparativo**
   - Nos modos **Automático** e **Duas datas específicas**, incluir um gráfico comparando as assimetrias entre A e B.
   - No modo **Intervalo**, adicionar séries de assimetria ao gráfico do período, quando houver dados suficientes.
   - Manter as tabelas atuais de mobilidade, força, composição e pliometria.

4. **Preservar regras recentes do comparativo**
   - Continuar usando as avaliações já consolidadas por data.
   - Não alterar dados no banco.
   - Não mexer no BodyMapSVG.
   - Não mexer nas regras de lançamento do Quadríceps +90°.

## Detalhes técnicos
- Arquivos previstos:
  - `src/components/avaliacoes-premium/tabs/EvolucaoTab.tsx`
  - `src/components/avaliacoes-premium/tabs/ComparativoTab.tsx`
  - Possível helper pequeno compartilhado dentro de `src/components/avaliacoes-premium/` para montar séries de assimetria.
- A fonte dos dados será `data.funcional.history`, que já vem deduplicada e mesclada por data.
- O cálculo usará `classificarAssimetria()` para mobilidade/flexibilidade e a mesma lógica percentual usada para força.

## Validação
- Conferir no preview um aluno com histórico funcional em mais de uma data.
- Validar que Evolução mostra as assimetrias quando selecionadas.
- Validar que Comparativo mostra última vs anterior e duas datas específicas.
- Conferir logs de build depois da implementação.
