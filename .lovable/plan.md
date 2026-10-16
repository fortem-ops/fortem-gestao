# Potência na prescrição de força puxando a Potência do Aquecimento

## Causa (confirmada no banco e no código)

Existem duas categorias com subcategorias de mesmo nome:
- Aquecimento > **Potência - AQ** > Saltos - quedas, Saltos - reativos, Saltos - rebotes, Saltos - estáticos, Saltos - aterrisagem, LPO - Trilha do Arremesso (Clean)...
- Parte Principal > **Potência** > as mesmas subcategorias, mais Hops, Bounds, LPO - Família Push...

Na linha de força a subcategoria escolhida (ex.: "Saltos - quedas") é salva só pelo nome. Ao buscar os exercícios, o sistema procura esse nome em toda a árvore sem preferência e fica com o primeiro que encontra — o do Aquecimento. Por isso a lista mostra os exercícios de Potência - AQ.

Também há a sigla "POT" marcada nas duas categorias, o que pode causar a mesma confusão.

## O que muda

1. Nas linhas da seção FORÇA de todos os métodos (Personalizado, 5-3-1, M102, Plan Strong, Foolproof, Easy Strength, X-Fab, PTTP, Planilha 5RM, Mile Deep e o detalhe do treino), a busca de exercícios passa a dar prioridade a **Parte Principal**. Quando o nome existe nos dois lugares, vêm os exercícios de Parte Principal > Potência.
2. Os blocos de aquecimento continuam como estão, buscando sempre em Aquecimento.
3. Subcategorias que só existem no Aquecimento continuam funcionando na força (sem ficar vazias).
4. Nenhum exercício nem prescrição salva é alterado.

## Detalhes técnicos

- `src/lib/exerciseMapping.ts`: no passo 3 de `resolverAlvo` (nome livre), `acharSub`, `acharCategoria` e `acharCategoriaPorSigla` passam a usar `GRUPO_PARTE_PRINCIPAL` como preferência quando `grupoPreferido` não foi informado (os blocos de aquecimento já passam `grupoPreferido="Aquecimento"`). Nova opção `OpcoesResolucao.grupoPreferencia` para quem precisar só preferir um grupo, sem a regra de bloco do passo 0.
- Conferir os `ExerciseSelector` de aquecimento sem `grupoPreferido` (ex.: `src/pages/BancoTreinos.tsx`, `WorkoutDetail.tsx`) e passar `GRUPO_AQUECIMENTO` onde faltar, para não serem afetados.
- Testes em `src/test/exerciseMapping.test.ts`: "Saltos - quedas" sem escopo resolve para Parte Principal > Potência; com `grupoPreferido: "Aquecimento"` resolve para Potência - AQ; subcategoria só do Aquecimento continua resolvendo. Rodar a suíte.
- Sem migração. A sigla "POT" duplicada na Parte Principal pode ser apagada depois em "Gerenciar Categorias", se quiser.
