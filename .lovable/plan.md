# Mostrar as assimetrias do aluno também nas planilhas de métodos

## O que acontece hoje

O bloco "Assimetrias do aluno · avaliação funcional de ..." (com sugestões de exercícios de aquecimento) aparece apenas na janela "Importar do Banco de Treinos", acima do detalhe do treino padrão.

Ao abrir uma planilha de método (5-3-1, M102, Plan Strong 50), o professor não vê essa informação.

## O que será feito

1. Exibir o mesmo bloco de assimetrias no topo das três planilhas de métodos:
   - 5-3-1
   - M102
   - Plan Strong 50
2. Posição: logo abaixo do cabeçalho (nome do método + aluno) e acima do cartão "Configuração", com o mesmo comportamento atual — recolhível e exibido apenas quando o aluno tiver assimetrias nas faixas amarela/vermelha.
3. Nada muda no cálculo, nas sugestões, no salvamento das planilhas nem na janela de importação.

## Detalhes técnicos

- Reutilizar `src/components/student/workout/AlunoDeficitsAlert.tsx` (props: `alunoId`).
- Inserir `<AlunoDeficitsAlert alunoId={alunoId} />` em:
  - `src/components/student/workout/Prescricao531Editor.tsx` (após o bloco de cabeçalho, antes do primeiro `<Card>`)
  - `src/components/student/workout/PrescricaoM102Editor.tsx` (mesmo ponto)
  - `src/components/student/workout/PrescricaoPlanStrongEditor.tsx` (mesmo ponto, no retorno principal)
- O componente já retorna `null` sem avaliação funcional ou sem sugestões, então não há estado vazio a tratar.
- Validação: `bunx tsgo --noEmit`, build e conferência visual abrindo um método pelo perfil do aluno.
