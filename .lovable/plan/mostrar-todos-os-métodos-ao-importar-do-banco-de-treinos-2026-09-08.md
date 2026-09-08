# Mostrar todos os MÉTODOS ao importar do Banco de Treinos

## O que acontece hoje

Na janela "Importar do Banco de Treinos" (dentro do perfil do aluno), a seção **Métodos** lista apenas dois itens: Personalizado e Planilha 5RM.

Faltam quatro métodos que existem na página Banco de Treinos:
- Personalizado 2
- 5-3-1
- M102
- Plan Strong 50

Motivo: a lista da janela filtra por uma relação fixa que não inclui "Personalizado 2", e os métodos 5-3-1, M102 e Plan Strong 50 são criados por aluno — eles não fazem parte dos modelos padrão e só foram adicionados manualmente na página Banco de Treinos.

## O que será feito

1. Incluir **Personalizado 2** na seção Métodos da janela de importação.
2. Adicionar os cartões **5-3-1**, **M102** e **Plan Strong 50** na mesma seção. Como o aluno já está definido nesse contexto, clicar no cartão abre direto o editor do método para aquele aluno (sem pedir para escolher o aluno de novo).
3. Ao salvar, a janela fecha e a lista de treinos do aluno é atualizada, igual aos demais modelos.
4. Nenhuma mudança na página Banco de Treinos nem no funcionamento atual dos modelos existentes.

## Detalhes técnicos

- `src/components/student/workout/ImportFromBankDialog.tsx`:
  - `PHASE_GROUPS` → Métodos passa a incluir `"Personalizado 2"`.
  - Acrescentar entradas sintéticas (`5-3-1`, `M102`, `Plan Strong 50`), como já é feito em `src/pages/BancoTreinos.tsx:1252-1272`.
  - Novo estado `metodoDireto` para renderizar, dentro do `DialogContent`, `Prescricao531Editor` / `PrescricaoM102Editor` / `PrescricaoPlanStrongEditor` com `alunoId`, `alunoNome`, `onBack` e `onSaved`.
  - Os editores exigem `alunoNome`: buscar nome via `alunos` (query por `alunoId`) ou aceitar `alunoNome` opcional como prop, passada por `StudentWorkouts.tsx` (`student.nome`) — preferir a prop, evitando query extra.
  - Importar os editores com `lazy` para não aumentar o peso inicial da janela.
- Validação: `bunx tsgo --noEmit`, build e conferência visual da janela no perfil de um aluno.
