## Tornar os 820 leads importados visíveis em /leads

### Contexto

A tela `/leads` lista apenas alunos cujo `current_pipeline_stage_id` é a etapa "Novo lead". Os 820 leads importados na migração foram criados com `status='lead'` mas **sem etapa do pipeline** (conforme escolha anterior "Sem estágio"), por isso não aparecem na tela.

### O que será feito

1. Identificar os 820 alunos com `origem_lead = 'Migração'` em `pipeline_metadata` que ainda estão sem `current_pipeline_stage_id`.
2. Para cada um, mover para a etapa **"Novo lead"** usando a função `fn_move_pipeline` com:
   - `_source = 'migration'`
   - `_notes = 'Importação sistema antigo — tornado visível em Leads'`
   - Preserva `created_at` original (a função só registra movimento; não altera data de cadastro).
3. Isso vai:
   - Setar `current_pipeline_stage_id` = id da etapa "Novo lead"
   - Registrar entrada em `pipeline_movements` (histórico)
   - Fazer com que apareçam imediatamente em `/leads` e no kanban do Pipeline (coluna "Novo lead")

### Execução

- Um único bloco SQL com `DO $$ ... LOOP ... fn_move_pipeline(...) ... END LOOP $$` rodando no banco.
- Filtro: `alunos.status='lead'` AND `pipeline_metadata.origem_lead='Migração'` AND `current_pipeline_stage_id IS NULL`.
- Verificação final: contar quantos ficaram na etapa "Novo lead" com origem "Migração".

### Observações

- Nenhuma alteração de código frontend.
- Nenhuma alteração de schema.
- Os leads passarão a aparecer também no kanban do Pipeline na coluna "Novo lead" (consequência esperada de estarem no pipeline).
