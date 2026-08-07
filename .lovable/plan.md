# Reativar ex-aluno como Prospect + Anamnese no Resumo

## 1. Reativar como Prospect

Ex-aluno (status inativo/encerrado) passa a poder voltar para o funil de Prospects, liberando o agendamento de treino experimental.

- Novo botão "Reativar como Prospect" no cabeçalho do perfil do aluno, ao lado de "Nova venda", visível apenas quando o status exibido é Inativo.
- Mesmo atalho disponível no CRM (card/drawer do funil de inativos), para converter direto da lista.
- Ao confirmar: abre um diálogo que reaproveita o formulário de conversão em Prospect (dados qualificados + anamnese, já preenchidos com o que existe no cadastro), permitindo atualizar as informações antes de confirmar.
- Efeito: status vira "prospect", movimento registrado no funil na etapa "Prospect" com nota "Reativação de ex-aluno", anamnese atualizada.
- Histórico intacto: planos, contratos, avaliações e cobranças antigas permanecem como estão. Nada é apagado nem reaberto.

## 2. Anamnese inicial no Resumo do perfil

- Novo card "Anamnese inicial" na aba Resumo, sempre visível, com as três perguntas:
  - Limitações de movimento, patologias, dores ou lesões
  - Prática de atividade física / tempo parado
  - Objetivo com o treinamento
- Botão "Editar" abre um diálogo para atualizar os três campos (permite manter a anamnese atualizada de um aluno inativo que retorna).
- Quando não houver anamnese salva, o card mostra estado vazio com botão "Preencher anamnese".
- Edição disponível para a equipe (mesmas permissões de quem edita dados cadastrais).

## Detalhes técnicos

- Backend: nenhuma mudança de schema. Reaproveita `prospect_anamnese` (upsert por `aluno_id`) e a RPC `fn_convert_lead_to_prospect`, que já faz update de status, upsert de anamnese e `fn_move_pipeline` para "Prospect" — apenas o texto da nota do movimento passa a diferenciar reativação.
  - Verificar as políticas de escrita de `prospect_anamnese` antes de habilitar a edição direta pelo card; se a atualização isolada não for permitida ao staff, salvar via a mesma RPC.
- Frontend:
  - `src/components/leads/ConvertToProspectDialog.tsx`: parametrizar título/descrição/nota para reuso no contexto de reativação (sem duplicar o formulário).
  - `src/pages/StudentProfile.tsx`: botão condicionado a `getDisplayStatus(...).key === "encerrado"`; após sucesso, `refetch` do aluno e invalidação de `aluno_display_status`, `trajetoria_aluno` e chaves de pipeline.
  - CRM: ação equivalente no card/drawer do funil de inativos (`PipelineCard`/`PipelineLeadDrawer`).
  - Novo componente `src/components/student/AnamneseCard.tsx` + diálogo de edição, consumido por `StudentSummary.tsx`, com query `prospect_anamnese` por `aluno_id` e invalidação após salvar.
