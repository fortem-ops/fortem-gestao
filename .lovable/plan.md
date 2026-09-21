# Substituição da nota do Diagnóstico Funcional

## Resultado
- Remover do cartão inicial o anel, a nota de 0 a 100 e qualquer leitura de `leftClass`/`rightClass`.
- Reutilizar `montarMedidasPortal` e `montarResumoPortal`, garantindo que a contagem de pontos seja idêntica à tela de avaliações.
- Mostrar dois selos compactos: o ponto de atenção mais preocupante e a medida mais equilibrada, incluindo os textos de empate solicitados.
- Preservar o título, o prazo de reavaliação, o acesso ao diagnóstico e o comportamento atual quando não há avaliação.

## Implementação
1. Adicionar em `portalAssessmentLogic.ts` uma função pura `montarSelosInicio(medidas)`, baseada em `nivel`, `razaoSevero`, `diferenca`, unidade e nomes já normalizados.
2. No `PortalHome.tsx`, converter os dados da última avaliação para o formato já usado pelo portal, montar medidas/resumo/selos e renderizar apenas verde, âmbar e coral em uma composição que caiba em 390 px.
3. Identificar força como `Força · …` e manter os nomes centralizados por `FORCA_EXERCICIO_LABEL` através da lógica existente.
4. Adicionar os seis cenários de teste pedidos, sem alterar regras clínicas nem dados gravados.

## Verificação
- Executar typecheck e a suíte completa, registrando literalmente os resultados e o número de testes.
- Conferir a pré-visualização em 390 px e o estado final do build.
- Informar todos os arquivos alterados.

## Limites
- Nenhuma mudança em motores, limiares, formulários, avaliações detalhadas ou outras áreas da tela inicial.
