# Relatórios: exclusão para a equipe e leitura correta

## 1. Exclusão liberada para toda a equipe

Hoje o botão "Excluir" só aparece para coordenação e administração, e a regra do banco também
bloqueia os demais. Passa a valer: qualquer pessoa da equipe (professor, nutricionista,
fisioterapeuta, coordenação, admin) pode excluir um relatório. Alunos continuam sem excluir.

- Regra do banco: a permissão de exclusão de avaliações passa a usar equipe em vez de
  coordenação/admin.
- Tela: o botão "Excluir" deixa de depender da permissão de coordenação e aparece para a equipe.
  O botão "Editar" e a gestão de anexos continuam como estão hoje.
- A confirmação "esta ação é irreversível" continua obrigatória antes de apagar.

## 2. Leitura do relatório em vez de código

Ao abrir relatórios dos tipos novos (por exemplo "relatorioforca" e "reabilitacao"), a janela
mostra o conteúdo bruto em formato de código, porque só os tipos antigos tinham exibição pronta.

Correção: qualquer relatório que tenha um modelo de perguntas cadastrado passa a ser exibido no
mesmo formato já usado no experimental — seções, pergunta e resposta, com o nome do modelo no
topo. O bloco de código só continua existindo como último recurso, para registros sem modelo
cadastrado.

Isso não altera as telas de Avaliação Funcional, Funcional V2, Composição Corporal nem o
lançamento das avaliações.

## Detalhes técnicos

- Migration: recriar a policy `avaliacoes_delete` como `is_staff(auth.uid())`.
- `AssessmentViewerDialog.tsx`:
  - novo `canDelete` a partir de uma checagem de staff (RPC `is_staff`), usado no lugar de
    `canEdit` apenas no botão Excluir.
  - generalizar a leitura: quando `avaliacao.protocolo_id` existir (qualquer tipo), buscar
    `avaliacao_protocolos.schema` e renderizar com `ExperimentalView`
    (`migrateLegacyDados` + `renderAnswerSummary`). `ensureFaseInicialQuestion` continua aplicado
    somente ao tipo `experimental`.
  - fallback `<pre>` mantido apenas quando não há schema.
- Validar com `bunx tsgo --noEmit` e build, e abrir um relatório de força e um de reabilitação
  para conferir a exibição.
