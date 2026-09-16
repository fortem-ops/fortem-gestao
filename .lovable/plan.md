# Comparativo: remover scores e mostrar lados (E/D)

## O que muda

Na aba **Comparativo** das Avaliações:

1. Saem as linhas de resumo das tabelas:
   - Score Mobilidade
   - Score Flexibilidade
   - Simetria
   - Risco (100 = baixíssimo)
   - Score Força (0–100)

2. Cada exercício/métrica passa a mostrar os dois lados separadamente, em vez da média:
   - Mobilidade/Flexibilidade: duas linhas por métrica — "Métrica (E)" e "Métrica (D)", em graus.
   - Força: duas linhas por exercício — "Exercício (E)" e "Exercício (D)", em kg.
   - Linhas sem valor nos dois lados continuam ocultas.

3. Permanece a linha "Nº métricas registradas" e as tabelas de Composição Corporal e Pliometria seguem como estão.

## Detalhes técnicos

- Arquivo: `src/components/avaliacoes-premium/tabs/ComparativoTab.tsx`.
- `funcRows`: remover as 4 primeiras linhas (scores) e trocar o helper `media` por leitura direta de `m.left` / `m.right`, gerando duas `CompareRow` por métrica de `ALL_FUNCTIONAL_METRICS`.
- `forcaRows`: remover a linha de Score Força e emitir duas linhas por exercício usando `esquerdo_kg` e `direito_kg`.
- `computePremiumScores` deixa de ser usado nessas duas funções (segue em uso no modo Intervalo/gráfico, sem alteração).
- Sem mudanças de backend, de outras abas ou do modo Intervalo.
- Verificação: `bunx tsgo --noEmit`.
