## Reorganização do menu "Cadastros"

Nova ordem no sidebar (todos visíveis conforme permissão atual):
1. **Leads** (`/leads`) — admin
2. **Prospects** (`/prospects`)
3. **Alunos Ativos** (`/alunos`) — renomeado de "Alunos"
4. **Alunos Inativos** (`/alunos-inativos`) — nova rota
5. **Anexos Jurídicos** continua (admin)

### 1. `src/components/AppSidebar.tsx`
- Reordenar `cadastrosItems` / `cadastrosAdminItems` para sair na ordem: Leads → Prospects → Alunos Ativos → Alunos Inativos → Anexos Jurídicos.
- Renomear "Alunos" → "Alunos Ativos".
- Adicionar item "Alunos Inativos" apontando para `/alunos-inativos` (mesmo ícone `Users` ou `UserX`).

### 2. Filtragem por status do plano
A página atual `StudentList.tsx` já calcula `getDisplayStatus` (key `ativo` / `encerrado` / `licenca` / `lead` / `prospect`).

- **Alunos Ativos** (`/alunos`): mostra apenas alunos cujo `display.key ∈ {ativo, licenca}` (plano ativo vigente, auto-renovável ou licença vigente). Lead/Prospect ficam fora porque já têm página própria.
- **Alunos Inativos** (`/alunos-inativos`): mostra apenas `display.key === 'encerrado'` (sem plano ativo OU plano vencido).

Implementação: adicionar prop `mode: "ativos" | "inativos"` em `StudentList` (ou criar `StudentListInativos.tsx` que reusa o componente). Dentro do `useMemo filtered`, aplicar pré-filtro fixo por modo, antes do filtro do usuário. O filtro de status do `StudentListFilters` continua funcionando dentro do subconjunto.

Header da página muda conforme modo:
- Ativos: "Alunos Ativos" + contagem dos ativos
- Inativos: "Alunos Inativos" + contagem dos inativos

### 3. Rotas em `src/App.tsx`
- Manter `/alunos` → `StudentList` (modo ativos por default).
- Adicionar `/alunos-inativos` → `StudentList mode="inativos"`.

### 4. Pipeline ↔ Cadastros (automação)
Já existe a função `fn_detect_evasao` que move alunos entre os funis "Aluno" e "Inativo" do Pipeline com base na mesma regra de plano ativo (vide `.lovable/plan.md`). Nada novo a criar:
- Quando um aluno perde plano ativo → `fn_detect_evasao` o joga no funil **Inativo** do Pipeline → ele aparece automaticamente em **Alunos Inativos** (mesma regra de display status).
- Quando renova/ganha plano ativo → volta ao funil **Aluno** → aparece em **Alunos Ativos**.

Verificar (sem mudar) que o botão "Recalcular status" continua disponível na lista de Alunos Ativos e Inativos para forçar sincronização.

### 5. Outros consumidores
- Dashboard widgets, links em `StudentProfile`, breadcrumbs etc. continuam usando `/alunos/:id` para o perfil — sem mudança.
- Buscas e atalhos que apontam para `/alunos` continuam levando para Alunos Ativos (comportamento esperado).

## Fora de escopo
- Não altera schema do banco (regra de status já está consolidada).
- Não altera Pipeline visualmente.
- Não cria nova tabela ou trigger — `fn_detect_evasao` já cuida da automação.
