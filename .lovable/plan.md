## Objetivo

Trocar a visualização atual do **Personalizado** (cards verticais empilhados por exercício) por uma **tabela** com as mesmas colunas das **Fases** (`# | Categoria | Exercício | Séries | Reps | Ações`), mantendo:

- A estrutura **Aquecimento (LIB/MOB/ATI) + Tabs de Treinos + Blocos** que o Personalizado já tem.
- As regras de exercícios **Simples** e **Dinâmico** (rotação Ímpar/Par ou N variantes; séries Compartilhado/Independente).
- Aquecimento, observações, salvar como modelo, exportar PDF, aplicar a aluno — tudo permanece.

Como o **Personalizado 2** hoje **reutiliza o mesmo `PersonalizadoEditor`**, esta mudança beneficia automaticamente os dois modelos. Nenhum novo arquivo é criado.

## O que muda na UI

Dentro de cada **Bloco** de cada **Treino**, a lista de exercícios passa a ser uma tabela com este cabeçalho:

```text
| # | Categoria | Exercício                       | Séries | Reps | Ações |
```

### Linha "Simples"
Uma única linha. Categoria via select, Exercício via `ExerciseSelector`, Séries/Reps editáveis inline, botão remover. Visualmente idêntico a uma linha de Fase.

### Linha "Dinâmico"
Renderizada como **um grupo de N+1 linhas** na mesma tabela:

- **Linha-cabeçalho do dinâmico**: ocupa toda a largura via `colSpan`. Mostra:
  - Badge `DINÂMICO` + selects de **Rotação** (Ímpar/Par | N variantes) e **Séries/Reps** (Compartilhado | Independente).
  - Quando `Compartilhado`: campos Séries e Reps na própria linha-cabeçalho.
  - Botões: `+ Variante` (só rotativa) e remover exercício inteiro.
- **N linhas de variante** logo abaixo:
  - `#` mostra o rótulo (`X`, `Y`, `S1/S2…` ou `1/3`, `2/3`, `3/3`).
  - Categoria herdada do dinâmico (somente leitura — uma única categoria por exercício).
  - Exercício via `ExerciseSelector`.
  - Séries/Reps editáveis somente quando modo `Independente`; caso contrário mostram os valores compartilhados em cinza.
  - Ação: remover variante (desabilitado quando `≤ 2`).

A separação visual entre exercícios será feita por uma **linha divisória mais forte**, e a separação entre Bloco 1 / Bloco 2 continua via cabeçalho do bloco com nome editável e botão `+ Exercício` (que abre o diálogo Simples/Dinâmico já existente).

### Aquecimento
Também migra para o mesmo padrão de tabela (`LIB`, `MOB`, `ATI` cada um com sua tabela: `# | Subcategoria | Exercício | Reps | Dias | Ações`), espelhando o cabeçalho usado nas Fases para o aquecimento.

## Arquivos afetados

- `src/components/student/workout/PersonalizadoEditor.tsx`
  - Substituir o `ExercicioRow` (card) por `ExercicioRowsTable` (1+ `<TableRow>` por exercício).
  - Reescrever o render de cada bloco para envolver os exercícios em `<Table><TableHeader>…</TableHeader><TableBody>{rows}</TableBody></Table>`.
  - Reescrever o render de cada bloco do Aquecimento (LIB/MOB/ATI) usando `<Table>` no mesmo estilo das Fases.
  - Manter `addExercicio`, `removeExercicio`, `updateExercicio`, `addBloco`, `removeBloco`, etc. inalterados — só muda apresentação.
  - Manter `NewExerciseButton` (diálogo Simples/Dinâmico) como gatilho de adicionar linha.

Nenhum outro arquivo precisa de alteração:

- `personalizadoTypes.ts`, `flattenPersonalizado` e o **PDF** continuam idênticos (formato persistido não muda).
- `BancoTreinos.tsx` não muda (continua roteando para `PersonalizadoEditor`).
- `Personalizado 2` herda o novo visual automaticamente.

## Não-objetivos

- Não alterar persistência nem o JSON salvo em `banco_treinos_personalizados`.
- Não mudar a saída em PDF.
- Não introduzir colunas Dias/Frequência por exercício no corpo do treino (continua sendo configurado no aquecimento, igual hoje).
