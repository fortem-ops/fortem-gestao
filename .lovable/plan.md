## Diagnóstico

O Rafael Gloria **está corretamente vinculado** a uma etapa do funil (`prospects → Informações encaminhadas`), mas não aparece no board.

Causa raiz: o `PipelineKanban` carrega alunos com `supabase.from("alunos").select(...)` sem nenhum filtro. Hoje temos **1.725 alunos cadastrados** e o PostgREST retorna no máximo 1.000 linhas por chamada — Rafael (e outros alunos com etapa) caem fora dessa janela e simplesmente não chegam ao front. Isso também explica por que mover a etapa pelo perfil "não tem efeito visível": a mudança é gravada, mas o registro nunca é entregue ao kanban.

Como bônus, a regra que o usuário pediu ("leads de migração não aparecem no Pipeline") já é satisfeita naturalmente se filtrarmos por `current_pipeline_stage_id IS NOT NULL`: os leads importados como migração foram limpos no passado e ficaram sem etapa, portanto não vão para o board — mas continuam visíveis em **Cadastros > Leads** (essa página não filtra por etapa). E se o usuário decidir promover um lead de migração ao CRM atribuindo manualmente uma etapa, ele passa a aparecer normalmente no Pipeline.

## Mudanças

### 1. `src/components/pipeline/PipelineKanban.tsx`
Na query `pipeline-alunos` (linha ~129), adicionar `.not("current_pipeline_stage_id", "is", null)` para:
- Reduzir o resultado a ~215 linhas (cabe no limite do PostgREST).
- Garantir que apenas alunos com etapa atribuída cheguem ao board.
- Excluir leads de migração que nunca foram colocados no funil.

Manter o restante da lógica (filtros, drag-and-drop, drawer) inalterado.

### 2. `src/components/dashboard/PipelineWidget.tsx`
Aplicar o mesmo filtro `.not("current_pipeline_stage_id", "is", null)` na query de alunos, pelo mesmo motivo de paginação — assim os KPIs "Novos leads (30d)" e contagens por etapa do widget também ficam corretos quando a base ultrapassar 1.000 registros.

### 3. Validação manual (sem código)
Após o ajuste, abrir **Comercial > Pipeline** e confirmar que Rafael Gloria aparece em **Prospects → Informações encaminhadas**. Confirmar também que **Cadastros > Leads** continua listando os leads de migração (essa tela não é tocada).

## Fora de escopo
- Adicionar um filtro/aba dedicada para "Leads de migração" em algum outro módulo.
- Mexer em `src/pages/Leads.tsx`, que já mostra os leads de migração corretamente.
- Job de limpeza/realocação automática dos leads de migração.
