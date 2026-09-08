# Sugestões de aquecimento não aparecem após vincular exercícios

## O que foi verificado

- Os vínculos existem no banco: 10 exercícios com `tornozelo-esquerdo` e 10 com `tornozelo-direito`, todos de Aquecimento / Mobilidade Articular.
- As chaves gravadas batem exatamente com as usadas pelas recomendações (`Mobilidade Tornozelo` → `tornozelo-esquerdo` / `tornozelo-direito`).
- As permissões de leitura estão corretas: qualquer usuário autenticado pode ler os vínculos e os exercícios.

Ou seja, os dados estão certos — o que falha é a atualização da lista no aplicativo.

## Causa

A lista de exercícios vinculados é carregada uma única vez e guardada em memória por 10 minutos. Quem já tinha aberto o sistema antes de fazer os vínculos continua vendo a versão antiga (vazia), tanto em Avaliações > Recomendações quanto na tela de prescrição. Além disso, ao salvar os vínculos no Banco de Exercícios nada avisa essa lista de que ela precisa ser recarregada.

## O que será feito

1. Ao salvar um exercício no Banco de Exercícios (criação ou edição), avisar a lista de vínculos para recarregar imediatamente.
2. Reduzir o tempo de cache dessa lista e fazer com que ela verifique novidades ao abrir a tela de Recomendações e a tela de prescrição.
3. Conferir na tela, com o aluno atual, que as recomendações de Tornozelo passam a listar os exercícios vinculados e que o bloco de assimetrias na prescrição mostra os mesmos exercícios.

Sem mudanças no banco de dados e sem alterar a lógica de cálculo das assimetrias.

## Detalhes técnicos

- `src/hooks/useExerciciosPorArticulacao.ts`: `staleTime` de 10 min para ~30 s e `refetchOnMount: true`.
- `src/components/student/StudentExerciseBank.tsx`: após gravar/limpar linhas em `exercicio_articulacoes`, `queryClient.invalidateQueries({ queryKey: ["exercicios-por-articulacao"] })`.
- Validar com `bunx tsgo --noEmit`, build e verificação visual em Resultados > Recomendações e no diálogo de prescrição.
