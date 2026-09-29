# Abrir cada método de treino na tela certa ao "Visualizar" no perfil do aluno

## O que acontece

Ao clicar em "Visualizar" num treino, o perfil do aluno só reconhece três métodos: Personalizado, M102 e 5-3-1. Qualquer outro método com aquecimento por blocos é tratado como se fosse 5-3-1, e a tela quebra.

Treinos salvos hoje que dão erro:
- Planilha 5RM: 1 (Bárbara Borques)
- Plan Strong 50: 13
- Easy Strength: 2

Estes métodos ainda não têm treino salvo, mas quebrariam do mesmo jeito: Foolproof, Mile Deep 1RM, Mile Deep 5RM, PTTP, PTTP 2 e X-Fab.

Os modelos antigos (Fase 1-4, 2x3 etc.), o Personalizado, o M102 e o 5-3-1 abrem normalmente.

## O que será feito

1. Ao visualizar, cada método abre na mesma tela usada no Banco de Treinos, já com o treino do aluno carregado, podendo editar e publicar.
2. A tela do 5-3-1 passa a abrir só para treinos 5-3-1 de verdade. Se receber um treino incompleto, mostra vazio em vez de quebrar.
3. Nada muda no Banco de Treinos, no Portal do Aluno nem nos modelos antigos.

## Detalhes técnicos

- `WorkoutDetail.tsx`: antes do fallback do 5-3-1, identificar cada método pelo marcador salvo (`isPlanilha5RMContent`, `variante` PLANSTRONG50, EASYSTRENGTH, FOOLPROOF, MILEDEEP1RM, MILEDEEP5RM, PTTP, PTTP2, XFAB) ou por `template_fase`. Renderizar o editor correspondente (`Prescricao*Editor`) com `alunoId`, `alunoNome`, `initialTreinoId`, `initial`, `onBack` e `onSaved`, conferindo as props de cada um. Carregar os editores sob demanda (`lazy`).
- Remover o palpite "aquecimento em objeto = 5-3-1"; manter só `variante === "531"` ou `template_fase === "5-3-1"`.
- `Prescricao531Editor.tsx`: normalizar `initial` (listas ausentes viram vazias).
- Conferir se o Portal do Aluno (`usePortalWorkout`) mostra esses métodos; se não mostrar, só registrar, sem mudar.
- Validar no preview: Planilha 5RM da Bárbara, um Plan Strong 50 e um Easy Strength.
