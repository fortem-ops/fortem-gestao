# Corrigir erro ao visualizar treino da Bárbara Borques

## O que acontece

O treino que dá erro na Bárbara Borques Santana é uma **Planilha 5RM** (rascunho). Não é um 5-3-1. Ela não tem nenhum treino 5-3-1 salvo.

Ao clicar em "Visualizar", a tela confunde a Planilha 5RM com um 5-3-1, porque as duas guardam o aquecimento no mesmo formato. Então ela abre a tela do 5-3-1, que procura os "dias" do método. Como a planilha não tem esses dias, a tela quebra.

## O que será feito

1. Ao visualizar uma Planilha 5RM no perfil do aluno, abrir a tela certa da Planilha 5RM (a mesma usada no Banco de Treinos), já com o treino salvo carregado e podendo editar e publicar.
2. Deixar a tela do 5-3-1 protegida: se um dia receber um treino sem dias, ela mostra os dias vazios em vez de quebrar.
3. Nada muda nos treinos Personalizado, M102, 5-3-1 de verdade, nem nos modelos antigos.

## Detalhes técnicos

- `src/components/student/workout/WorkoutDetail.tsx`: antes do fallback do 5-3-1, detectar `isPlanilha5RMContent(treino.conteudo)` ou `template_fase === "Planilha 5RM"` e renderizar `PrescricaoPlanilha5RMEditor` com `alunoId`, `alunoNome`, `initialTreinoId`, `initial`, `onBack`, `onSaved`. Excluir esse caso da detecção por formato do aquecimento (`aqIsObject`).
- `Prescricao531Editor.tsx`: normalizar `initial` (dias/levantamentos/acessorios/auxiliares ausentes viram arrays vazios, conforme `frequencia`).
- Validar no preview abrindo o treino 59875b2b da Bárbara.
