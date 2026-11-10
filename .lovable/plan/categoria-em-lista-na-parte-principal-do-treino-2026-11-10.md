# Categoria em lista na parte principal do treino

## O que muda
No editor do treino (perfil do aluno > Treinos), depois de importar um treino de Fases, a coluna **Cat.** dos blocos A/B deixa de ser um campo de digitar e vira uma **lista para escolher**, como já acontece na Subcategoria do aquecimento.

- A lista mostra as categorias cadastradas no Banco de Exercícios para a parte principal (ex.: DQ, DJA, DJS, PV, PH, EV, EH, AH, AR, COND...), com a sigla e o nome.
- Ao trocar a categoria, o exercício da linha é limpo, para não ficar um exercício que não combina; a busca de exercícios passa a mostrar só os daquela categoria (como hoje).
- Treinos já salvos ou importados com uma categoria que não está na lista continuam mostrando essa categoria como opção (nada é apagado).
- Em modo só leitura, a categoria aparece como texto.

## O que não muda
Banco, Banco de Exercícios, modelos de Fases, outros métodos (5-3-1, M102 etc.), aquecimento e treinos já salvos.

## Detalhes técnicos
- `src/components/student/workout/WorkoutDetail.tsx` (~linha 620): trocar o `Input` de `ex.categoria` por `Select` com opções vindas de `useExerciseCategories()` (`categoriasForca`/árvore "Parte Principal", usando a sigla), incluindo o valor atual se ausente.
- Nova função `pickCategoria(tIdx, idx, val)` que grava categoria e zera `exercicio`, `video_url`, `exercicio_id`.
- Só frontend; typecheck e teste do helper de opções.
