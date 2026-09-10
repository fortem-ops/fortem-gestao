# Leads x Prospects: etapas corretas e janela de conversão sempre

## 1. Onde cada cadastro aparece

Hoje a tela Cadastros > Leads mostra apenas quem está em "Novo lead", e Cadastros > Prospects
mostra apenas "Prospect" e "Treino experimental agendado". Ajuste:

- Leads passa a listar: **Novo lead** e **Informações encaminhadas**.
- Prospects passa a listar: **Prospect**, **Treino experimental agendado** e **Follow Up**.

Assim, ao avançar a etapa, o cadastro muda de tela automaticamente, sem trabalho manual.

## 2. Janela de conversão sempre que virar Prospect

Qualquer movimento que leve um cadastro de uma etapa de Lead para uma etapa de Prospect
passa a abrir a janela "Converter em Prospect" (dados qualificados + anamnese), com os campos
obrigatórios. A conversão só é gravada quando a janela é confirmada; se for cancelada, o
cadastro permanece na etapa de origem.

Pontos cobertos:
- Arrastar o card no funil (Kanban).
- Botão "Avançar etapa" no painel lateral do card.
- Mudança de etapa pelo perfil do aluno.
- Botão de conversão já existente em Cadastros > Leads (mantém o comportamento atual).

Nada muda para movimentos que não entram no grupo de Prospect (perda, avaliação, aluno ativo,
reativação de ex-aluno), nem para preços, contratos ou permissões.

## Detalhes técnicos

- Criar em `src/lib/pipeline.ts`: `LEAD_STAGE_NAMES = ["Novo lead", "Informações encaminhadas"]`,
  `PROSPECT_STAGE_NAMES = ["Prospect", "Treino experimental agendado", "Follow Up"]`, mais
  `isLeadStage()` / `isProspectStage()` e `requiresProspectConversion(from, to)`.
- `src/pages/Leads.tsx`: trocar a query `stage-novo-lead` (`.eq`) por busca das duas etapas e
  `.in("current_pipeline_stage_id", ids)`; manter KPIs.
- `src/pages/Prospects.tsx`: usar a nova constante com três etapas (inclui Follow Up) nas
  queries e nos badges de etapa.
- `PipelineKanban.tsx#handleDragEnd`: antes do `fn_move_pipeline`, se
  `requiresProspectConversion(stageAtual, targetStage.name)`, guardar `pendingConvert` e abrir
  `ConvertToProspectDialog` (sem update otimista); invalidar `pipeline-alunos`,
  `pipeline-last-moves`, `leads-list`, `prospects-list` no `onConverted`.
- `PipelineLeadDrawer.tsx#moveNext` e `StudentPipelinePanel.tsx#moveTo`: mesma checagem antes
  do RPC, abrindo o mesmo diálogo.
- `ConvertToProspectDialog` já chama `fn_convert_lead_to_prospect` (status + anamnese +
  `fn_move_pipeline` para "Prospect"); reaproveitar sem duplicar lógica. Quando a etapa de
  destino for "Treino experimental agendado" ou "Follow Up", executar um `fn_move_pipeline`
  adicional para a etapa escolhida após a conversão.
- Sem mudanças de schema, RLS ou funções do banco.
