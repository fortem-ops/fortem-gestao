## Ajuste na Sidebar

### Objetivo
1. Renomear o item "Agenda" para "Agenda de Serviços" na sidebar principal.
2. Criar uma nova categoria "Agendas" na sidebar.
3. Mover "Agenda de Serviços" e "Presenças" para essa nova categoria.

### Mudanças
- **Arquivo:** `src/components/AppSidebar.tsx`
  - Remover "Agenda" e "Presenças" do array `principalItems`.
  - Criar novo array `agendasItems` com os dois itens ("Agenda de Serviços" e "Presenças").
  - Inserir novo `<SidebarGroup label="Agendas">` logo após o grupo "Principal", renderizando `agendasItems`.

Nenhuma outra alteração no sistema é necessária (URLs, permissões e funcionalidades permanecem as mesmas).