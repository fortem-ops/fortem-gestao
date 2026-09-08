# Escolher aluno antes de abrir a planilha no Banco de Treinos

Hoje só 5-3-1, M102 e Plan Strong 50 pedem o aluno antes de abrir. As Fases, Personalizado e Corrida abrem direto o modelo geral, sem os dados de assimetria do aluno.

## Como vai ficar

1. Ao clicar em qualquer cartão do Banco de Treinos (Fases 1-4, Personalizado, Personalizado 2, Corrida), aparece primeiro a janela "Escolha o aluno" — a mesma já usada nos métodos.
2. Professor: escolher o aluno é obrigatório.
3. Coordenador e Admin: a mesma janela traz o botão "Ver modelo sem aluno", que abre a planilha do jeito atual, para editar o modelo geral.
4. Com aluno escolhido, a planilha abre com:
   - o nome do aluno no topo;
   - o bloco de assimetrias e sugestões de aquecimento (o mesmo já usado nas planilhas dos métodos);
   - um botão "Prescrever para o aluno", que aplica a planilha como treino atual dele (arquiva o treino anterior, cria a nova versão) e mostra confirmação.
5. Quando aberto com aluno, a planilha fica em modo leitura das escolhas do modelo (não altera o modelo geral); a edição do modelo continua acontecendo no caminho "sem aluno" de coordenador/admin.

## Detalhes técnicos

- `src/pages/BancoTreinos.tsx`: novo estado `alunoParaTemplate: { template, aluno } | null` e `selectAlunoFor: WorkoutTemplate | null`. O `onClick` dos cartões não sintéticos passa a abrir `Select531AlunoDialog` guardando o template pretendido; o `onSelect` define o par template+aluno.
- `Select531AlunoDialog`: nova prop opcional `allowSkip?: boolean` + `onSkip?: () => void`, renderizando o botão "Ver modelo sem aluno" apenas quando `canEdit` (`rolesInfo.isCoordAdmin`) for verdadeiro.
- `TemplateDetail`: novas props opcionais `alunoId?`, `alunoNome?` e `onPrescrever?`. Quando `alunoId` existir, renderiza `AlunoDeficitsAlert` abaixo do cabeçalho, mostra o nome do aluno e o botão de prescrever, e recebe `canEdit={false}` para não editar o modelo.
- Prescrição reutiliza `prescribeFaseInicial(faseNome, alunoId, autorId)` de `src/lib/workoutImport.ts` (já arquiva o atual e calcula a próxima versão); autor vem de `useAuth`. Para Corrida/Personalizado sem entrada em `WORKOUT_TEMPLATES`, o botão de prescrever fica oculto nesta leva.
- Sem mudanças em `ImportFromBankDialog`, nos editores 5-3-1/M102/Plan Strong ou no fluxo `PersonalizadoEditor`.

## Validação

- Typecheck e build.
- Conferir no navegador: cartão de Fase abre a escolha de aluno; com perfil coord/admin o atalho "ver modelo sem aluno" aparece; com aluno escolhido aparecem as assimetrias e o botão de prescrever.
