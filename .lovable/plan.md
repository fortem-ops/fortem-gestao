# Mover Pipedrive para /pipeline + mapeamento de etapas

Sim, é totalmente possível mapear etapas. Hoje todo lead importado cai em "Novo lead"; vou adicionar mapeamento configurável entre **stages do Pipedrive** e **stages do Fortem** (qualquer um dos 14 já existentes — Novo lead, Prospect, Treino experimental agendado, Avaliação agendada, Aluno ativo, etc.).

## Mudanças

### 1. Mover a UI para /pipeline
- Remover a aba "Integração Pipedrive" de `/admin` (limpar import + entrada em `allTabs` em `src/pages/Admin.tsx`).
- Em `src/pages/Pipeline.tsx`, adicionar botão **"Importar do Pipedrive"** no header (admin only, ao lado de "Recalcular status" e "Gerenciar etapas").
- Renomear `AdminPipedrive.tsx` → `src/components/pipeline/PipedriveImportSheet.tsx`. Trocar layout de página para **Sheet/Dialog em tela cheia** (mais natural dentro do Pipeline). Mesmo conteúdo: status, filtros, tabela, importação.

### 2. Tabela de mapeamento de etapas
Migration nova:

```sql
CREATE TABLE public.pipedrive_stage_mapping (
  pipedrive_stage_id int PRIMARY KEY,
  pipedrive_stage_name text,
  fortem_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipedrive_stage_mapping TO authenticated;
GRANT ALL ON public.pipedrive_stage_mapping TO service_role;
ALTER TABLE public.pipedrive_stage_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/Coord manage stage mapping" ON public.pipedrive_stage_mapping
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador'));
```

### 3. UI de mapeamento (dentro do Sheet)
Seção "**Mapeamento de etapas**" acima da tabela de deals:
- Aparece após o primeiro "Buscar leads" (que descobre os stages do Pipedrive presentes nos deals retornados).
- Tabela: `Stage Pipedrive` → `Select com stages do Fortem` (agrupados por funnel: Prospects / Aluno / Inativo) → botão "Salvar mapeamento".
- Stages não mapeados caem no fallback **"Novo lead"** com badge de aviso.
- Mapeamento é persistido em `pipedrive_stage_mapping` (upsert por `pipedrive_stage_id`).

### 4. Importação respeita o mapeamento
Atualizar `supabase/functions/pipedrive-import-leads/index.ts`:
- Aceitar novo campo opcional `pipedriveStageId` por item.
- Carregar `pipedrive_stage_mapping` em batch para os stage IDs recebidos.
- Para cada item, resolver stage destino: mapeamento → nome da stage do Fortem → `fn_move_pipeline(_to_stage_name=...)`. Sem mapeamento → "Novo lead".

Atualizar `src/lib/pipedrive.ts` para enviar `pipedriveStageId` em `importPipedriveLeads`.

### 5. Status do deal Pipedrive
A função `pipedrive-list-leads` hoje só busca `status=open`. Vou adicionar filtro UI **"Status do deal"** (Aberto/Ganhos/Perdidos/Todos) — útil quando queremos importar histórico já fechado para reconstituir base no Fortem.

## Fora de escopo (continua na fase 2)

- Espelhamento Fortem → Pipedrive (atualizar deal quando lead muda de stage no Fortem).
- Sync automático/agendado.
- Importação de Activities ↔ tarefas.

## Validação final

- Botão "Importar do Pipedrive" visível em `/pipeline` para admin; some de `/admin`.
- Salvar mapeamento `Stage 8 → Prospect` e importar 1 deal desse stage → aluno aparece direto em "Prospect" no kanban (não em "Novo lead").
- Deal sem mapeamento ainda cai em "Novo lead".
- Re-importar continua idempotente.
