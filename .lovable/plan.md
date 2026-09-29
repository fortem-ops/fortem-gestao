# Mostrar a avaliação do aluno ao importar treino de outro aluno

## O que será feito

Na janela "Importar treino de outro aluno" (perfil do aluno > Treinos), mostrar o mesmo quadro "Assimetrias do aluno" que aparece ao planejar no Banco de Treinos. O quadro traz a data da última avaliação funcional, os déficits de cada lado e os exercícios sugeridos.

- O quadro é sempre do aluno que vai **receber** o treino, não do aluno de onde o treino é copiado.
- Aparece nas duas etapas: ao escolher o treino e ao editar a cópia antes de salvar.
- Se o aluno não tiver avaliação com assimetrias, o quadro não aparece. É o mesmo comportamento do Banco de Treinos.
- Nada muda na cópia, no salvamento nem nas outras telas.

## Detalhes técnicos

- `src/components/student/workout/ImportFromStudentDialog.tsx`: renderizar `<AlunoDeficitsAlert alunoId={alunoId} />` abaixo do `DialogHeader` nas duas etapas (antes do `StudentPicker` e antes do `PersonalizadoEditor`).
- Validar no preview abrindo a janela no perfil de um aluno com avaliação.
