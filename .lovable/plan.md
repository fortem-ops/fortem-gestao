## Objetivo
Adicionar uma seção **Inadimplentes** ao Dashboard, alimentada pelos mesmos dados exibidos em **Financeiro › Contratos** (KPI "Inadimplentes" e `inadimplencias_view`), permitindo ação rápida.

## Escopo

### 1. Novo widget `InadimplentesWidget.tsx`
Local: `src/components/dashboard/InadimplentesWidget.tsx`

- Usa o hook existente `useInadimplenciasAbertas()` (lê `inadimplencias_view` filtrando `status = 'aberta'`) — mesma fonte da aba Financeiro › Contratos, garantindo correlação 1:1.
- Layout em `glass-card`, padrão visual idêntico aos demais widgets (ex.: `PlansDistributionWidget`, `AdminAlertsWidget`).
- Cabeçalho:
  - Título "Inadimplentes" + ícone `AlertTriangle` (tom danger).
  - Badge com a contagem total.
  - Botão "Ver todos" → navega para `/financeiro/contratos`.
- Conteúdo:
  - 3 KPIs compactos: **Total em aberto** (R$), **Parcelas vencidas** (qtd), **Alunos afetados** (qtd distintos).
  - Lista das 5 inadimplências mais antigas (maior `dias_atraso`):
    - Nome do aluno (link → `/alunos/{id}?tab=contrato`)
    - Plano + forma de pagamento (badges)
    - Valor em aberto e dias de atraso (badge danger)
  - Estado vazio: "Nenhuma inadimplência em aberto" com ícone de check.
- Estado de loading com `Skeleton`.

### 2. Integração no `Dashboard.tsx`
- Renderiza o `InadimplentesWidget` **apenas para Coord/Admin** (`isCoordAdmin`), já que professores não veem dados financeiros.
- Posição: na coluna principal (`lg:col-span-2`), logo após o `AdminAlertsWidget`, antes do final.

### 3. Correlação com Financeiro › Contratos
- Fonte de dados única: `inadimplencias_view` + `status = 'aberta'` (mesma usada no KPI da página Contratos).
- Clique em "Ver todos" leva à página `/financeiro/contratos` já existente; clique no aluno abre o perfil na aba **Pagamentos** (rota `/alunos/{id}?tab=contrato`).
- Nenhuma mudança em schema, RPC ou na página Contratos — somente leitura.

## Arquivos
- **Criar**: `src/components/dashboard/InadimplentesWidget.tsx`
- **Editar**: `src/pages/Dashboard.tsx` (importar e posicionar o widget na seção Coord/Admin)

## Fora de escopo
- Não altera o módulo Financeiro nem cria novas views.
- Não envia notificações nem cobranças (ações já existem na página Contratos).
