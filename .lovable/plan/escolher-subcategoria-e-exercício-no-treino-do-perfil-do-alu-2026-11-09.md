# Escolher subcategoria e exercício no treino do perfil do aluno

## Problema
No editor de treino do perfil do aluno (aba Treinos), o Aquecimento (Liberação, Mobilidade, Ativação, Preventivo) mostra a subcategoria como um campo de texto livre. A busca de exercícios não usa essa subcategoria, então não dá para escolher uma subcategoria e depois o exercício correspondente. Os editores XFab, Planilha 5RM e PlanStrong já fazem isso do jeito certo.

## O que muda
- A coluna **Subcategoria** de cada bloco do Aquecimento vira uma lista com as subcategorias cadastradas no Banco de Exercícios para aquele bloco (por exemplo, Mobilidade > Quadril, Torácica, Pé/Tornozelo...).
- Trocar a subcategoria limpa o exercício da linha, para não sobrar um exercício que não pertence a ela.
- A busca de **Exercício** passa a mostrar só os exercícios daquela subcategoria ("Buscar em Quadril..."). Ela fica bloqueada até a subcategoria ser escolhida.
- Treinos já salvos com uma subcategoria digitada que não está na lista continuam mostrando esse valor e podem ser trocados. Nada salvo é apagado.
- No modo somente leitura, a tela continua igual.

## Fora do escopo
Bloco principal do treino, outros métodos, Banco de Exercícios, banco de dados e regras de salvamento.

## Detalhes técnicos
- Arquivo: `src/components/student/workout/WorkoutDetail.tsx` (linhas ~455–473).
- Trocar o `Input` por um `Select` com as subcategorias de `useExerciseCategories().tree`, resolvidas como no `PrescricaoXFabEditor.tsx` (`resolverAlvo` com `grupoPreferido = GRUPO_AQUECIMENTO`). Se o valor atual não estiver na lista, ele entra como opção extra.
- No `onValueChange`, gravar `subcategoria` e limpar `exercicio` e `video_url` (mais `exercicio_id`, se existir).
- No `ExerciseSelector`, passar `grupoPreferido`, `subcategoria={ex.subcategoria}`, `disabled={!ex.subcategoria}` e um placeholder.
- Validação: typecheck e conferir no navegador a escolha Mobilidade > subcategoria > exercício.
