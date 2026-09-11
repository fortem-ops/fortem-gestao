# Corrigir imagem rosa da Regata na Store

## Diagnóstico confirmado
- A **Regata - Feminina** possui uma imagem rosa cadastrada nas variações da cor **Rosa**.
- As três fotos da galeria do produto estão cadastradas como gerais, sem cor, e mostram a versão vermelha.
- Ao selecionar Rosa, a tela encontra a galeria geral e deixa de usar a imagem rosa da variação. Por isso, a escolha da cor não altera a foto principal.

## Implementação
1. Ajustar a montagem das imagens na página do produto para considerar a foto da variação selecionada.
2. Quando houver galeria específica da cor, mantê-la como prioridade.
3. Quando não houver galeria específica, mostrar a imagem da variação escolhida como principal e preservar as fotos gerais como miniaturas adicionais, sem duplicar imagens.
4. Manter a vitrine inicial e os demais produtos inalterados.

## Validação
- Abrir a Regata Feminina na Store e selecionar **Rosa**.
- Confirmar que a foto principal muda para a regata rosa e carrega corretamente.
- Confirmar que as miniaturas gerais continuam disponíveis e que Vermelha e demais produtos não sofrem regressão.
- Rodar o typecheck e verificar o build.
