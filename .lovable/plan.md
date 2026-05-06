## Gerenciar Etapas do Funil de Vendas (Pipeline)

Adicionar uma interface administrativa para criar, editar, reordenar, recolorir e excluir as etapas do pipeline (`pipeline_stages`).

### Acesso
- Botão **"Gerenciar etapas"** no topo da página `/pipeline`, visível apenas para **Admin** (mesma regra do botão "Detectar evasão").
- Abre um Dialog dedicado.

### Funcionalidades do Dialog
- **Listar** todas as etapas ordenadas por `position`.
- **Criar** nova etapa (nome + cor; posição = última + 1).
- **Editar inline** o nome de cada etapa.
- **Selecionar cor** entre as 6 disponíveis em `STAGE_COLORS` (`blue`, `amber`, `orange`, `emerald`, `rose`, `zinc`) com swatches clicáveis.
- **Reordenar** com botões ↑ / ↓ (troca `position` com a etapa adjacente). Mantém simples sem drag-and-drop para evitar dependência extra.
- **Ativar/desativar** (`is_active`) via Switch — etapas inativas não aparecem no Kanban mas preservam histórico.
- **Excluir** com confirmação. Antes de excluir, consultar quantos alunos estão na etapa; se > 0, bloquear e instruir mover alunos primeiro (evita FK órfãs em `alunos.current_pipeline_stage_id` e `pipeline_movements`).

### Proteções
- Etapas com nomes especiais usados pela automação (`Risco de evasão`, `Recuperado`, e demais referenciadas em `fn_detect_evasao` / `fn_move_pipeline`) podem ser editadas em cor/ordem, mas exibem aviso ao tentar **renomear ou excluir** (a lógica server-side procura por nome).
- Toda mutação invalida `["pipeline-stages"]`, `["pipeline-alunos"]` e `["dashboard-pipeline-widget"]`.

### Arquivos
- **Novo:** `src/components/pipeline/ManageStagesDialog.tsx` — UI completa do gerenciador.
- **Editado:** `src/pages/Pipeline.tsx` — adicionar botão "Gerenciar etapas" (admin only) que abre o dialog.

### Observação técnica
As RLS já existentes em `pipeline_stages` permitem INSERT/UPDATE/DELETE apenas para admin (`is_admin(auth.uid())`), então nenhuma migration é necessária.
