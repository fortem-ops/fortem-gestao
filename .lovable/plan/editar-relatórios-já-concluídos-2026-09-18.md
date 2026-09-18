# Editar relatórios já concluídos

## O que muda

Hoje, ao abrir um relatório salvo, o botão "Editar" só aparece no tipo experimental — nos demais
(Relatórios Técnicos de força, corrida, reabilitação e outros tipos criados em Administração) o
relatório fica somente para leitura depois de finalizado.

Passa a valer:

- Todo relatório com formulário cadastrado pode ser editado depois de concluído, direto na janela
  de visualização, com o mesmo formulário usado no preenchimento (salvamento automático, com o
  selo "Finalizada"/"Rascunho" e o botão de reabrir como rascunho já existentes).
- A permissão de editar passa a ser a mesma da exclusão: qualquer pessoa da equipe (professor,
  nutricionista, fisioterapeuta, coordenação, administração). Aluno continua sem editar.
- Ao sair do modo de edição, a janela volta à leitura com o conteúdo atualizado.

Nada muda nas telas de Avaliação Funcional, Funcional V2 e Composição Corporal, nem no
lançamento de novos relatórios.

## Detalhes técnicos

- `AssessmentViewerDialog.tsx`:
  - o botão "Editar" deixa de exigir `isExperimental` e `canEdit` (coord/admin): passa a aparecer
    para qualquer relatório dinâmico (`isDynamic`) com schema disponível, condicionado a `canDelete`
    (RPC `is_staff`), renomeado para `canEditar` e reaproveitado também nos anexos.
  - no modo `editing`: manter `ExperimentalAssessment` para `tipo === "experimental"` sem
    `protocolo_id`; para os demais, renderizar `DynamicAssessment` com
    `student`, `tipoSlug={avaliacao.tipo}`, `protocoloId={avaliacao.protocolo_id}`,
    `schema={protocoloInfo.schema}` e `avaliacaoId={avaliacao.id}`.
  - adicionar botão "Concluir edição" que sai de `editing`, invalida as queries de avaliações do
    aluno e refaz a leitura.
- Sem migration: a policy de UPDATE de `avaliacoes` já cobre a equipe (confirmar antes de
  implementar; se estiver restrita a coordenação/admin, alinhar via migration de policy).
- Validar com typecheck, build e abertura de um relatório de força e um de reabilitação.
