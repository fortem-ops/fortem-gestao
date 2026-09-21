# Flexibilidade Quadríceps — entrada a partir dos 90°

## Objetivo
No lançamento de mobilidade, o profissional mede o quadríceps com o goniômetro a partir dos 90° de flexão do joelho. Hoje ele precisa somar 90 mentalmente, porque as faixas de classificação (Fraco ≤120° … Excelente ≥150°) esperam o valor absoluto. O sistema passa a somar os 90° automaticamente, com uma nota visível informando que os 90° já estão incluídos no cálculo.

## Escopo (confirmado)
- Aplicar no **Lançamento > Mobilidade** (avaliações premium) e na **avaliação funcional v2**.
- Ao **editar** um lançamento antigo, o campo mostra o valor salvo **− 90** (leitura do goniômetro); ao salvar, soma 90 novamente.
- O formulário legado (`AssessmentForm.tsx`, usado em Avaliações antigas) **não** é alterado.

## Mudanças

### 1. Helper compartilhado — `bodyMapLogic.ts`
- Constante `QUADRICEPS_OFFSET_GRAUS = 90` e funções:
  - `quadricepsEntradaParaValor(v)` → `v + 90` (leitura do goniômetro → valor absoluto salvo/classificado)
  - `quadricepsValorParaEntrada(v)` → `v − 90` (valor salvo → preenchimento do campo na edição)
  - `isQuadriceps(metric)` ou uso direto do nome `"Flexibilidade Quadríceps"`.
- Fonte única da regra, evitando duplicar a lógica nos dois formulários.

### 2. `MobilidadeTab.tsx` (Lançamento > Mobilidade)
- Ao montar `rows` (linhas ~305-320): para "Flexibilidade Quadríceps", converter a leitura com `quadricepsEntradaParaValor` **antes** de `classifyAngle` e de gravar — o valor salvo continua absoluto (nada muda no banco, nas faixas ou nos percentis).
- Em `abrirEdicao`: para quadríceps, preencher o campo com `quadricepsValorParaEntrada` (valor salvo − 90).
- Nota visível sob o rótulo "Flexibilidade Quadríceps" na tabela do formulário: texto curto em destaque discreto, ex.: *"Meça a partir de 90° — os 90° já estão incluídos no cálculo."*

### 3. `FuncionalV2Assessment.tsx` (avaliação funcional v2)
- Mesma conversão nos dois pontos que montam `rows`/`classifyAngle` a partir de `values` (linhas ~66-78 e ~207-212), para que a classificação exibida ao lado do campo já considere o valor absoluto.
- Mesma nota sob o rótulo da métrica na tabela de entrada.
- Edição neste fluxo: verificar se existe preenchimento de valores anteriores; se houver, aplicar `quadricepsValorParaEntrada` no prefill.

### 4. Testes — `src/test/`
- Testes puros do helper: entrada 45 → 135; classificação de 135 → "Médio"; entrada 60 → 150 → "Excelente"; edição 135 → campo 45.
- Garantir que as demais métricas não sofrem nenhuma conversão.

## Fora de escopo / preservado
- Nenhuma mudança em faixas de classificação, percentis, base de referência ou `computePremiumScores()` — os valores continuam sendo salvos e comparados em graus absolutos.
- Banco de dados: nenhuma migration; dados históricos já estão absolutos.
- BodyMapSVG, gráficos e demais abas: sem alteração.

## Verificação
- Rodar os testes automatizados.
- No preview: lançar quadríceps com leitura 45/50 e confirmar que o histórico mostra 135°/140° com a classificação correta; abrir a edição e confirmar que os campos voltam com 45/50; conferir a nota visível nos dois formulários.
