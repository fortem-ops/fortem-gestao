## Objetivo
Permitir que cada usuário reordene livremente os widgets do Dashboard via arrastar-e-soltar, salvando a preferência pessoal para retornar igual na próxima sessão.

## Escopo

### 1. Modo "Personalizar" no Dashboard
- Botão **Personalizar** no cabeçalho do Dashboard (ao lado do filtro de professor).
- Ao ativar:
  - Cada widget recebe uma alça de arrasto (ícone `GripVertical`) e um leve realce (borda tracejada / cursor `grab`).
  - Aparecem botões **Salvar** e **Restaurar padrão**.
- Fora do modo, o dashboard fica idêntico ao atual (sem alças, sem distração visual).

### 2. Drag-and-drop
- Usar `@dnd-kit/core` + `@dnd-kit/sortable` (já presentes no projeto, usados no Pipeline).
- Reordenação **dentro de cada coluna** (principal e lateral). Mover entre colunas fica fora do escopo desta primeira versão.
- Cada widget vira um item `Sortable` identificado por uma chave estável (`alerts`, `plansDistribution`, `adminAlerts`, `inadimplentes`, `tasks`, `ponto`, `birthdays`, `clube`, `pipeline`).

### 3. Persistência
- Preferência salva por usuário em `localStorage` na chave `dashboard:widget-order:{userId}`:
  ```json
  { "main": ["alerts","plansDistribution","adminAlerts","inadimplentes"],
    "side": ["pipeline","ponto","clube","tasks","birthdays"] }
  ```
- Persistência local mantém a UX leve, sem migração de banco. Se algum dia for necessário sincronizar entre dispositivos, abrimos uma tarefa específica.
- Ao montar, o Dashboard lê a preferência; widgets novos (não presentes na lista salva) são adicionados ao final automaticamente.
- "Restaurar padrão" remove a chave e volta à ordem default.

### 4. Respeito ao RBAC
- A lista de widgets disponíveis continua dependendo do papel (Coord/Admin vs Professor) — ordem personalizada se aplica apenas aos widgets visíveis para aquele perfil.
- O `StatsCards` (KPIs do topo) e banners (`LembretePontoBanner`, `LembreteAvaliacoesPendentesBanner`) **não** são reordenáveis — permanecem fixos.

## Arquivos
- **Criar**:
  - `src/hooks/useDashboardLayout.ts` — leitura/escrita da preferência + merge com defaults.
  - `src/components/dashboard/SortableWidget.tsx` — wrapper `useSortable` com alça de arrasto.
- **Editar**:
  - `src/pages/Dashboard.tsx` — registro dos widgets, modo personalizar, `DndContext` + `SortableContext` por coluna.

## Fora de escopo
- Mover widgets entre colunas (apenas reordenação dentro da própria coluna).
- Esconder/exibir widgets individualmente.
- Sincronização da preferência entre dispositivos (fica em `localStorage`).
- Mudanças no conteúdo dos widgets.
