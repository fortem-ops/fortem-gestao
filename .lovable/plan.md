# Responsividade Mobile — Áreas internas

Objetivo: garantir que todas as páginas internas do app renderizem corretamente em telas ≤768px, sem overflow horizontal, sem texto cortado e sem controles inacessíveis.

## Princípios aplicados a todas as telas

- Cabeçalhos de página (título + botões de ação) passam de `flex` rígido para `flex-wrap` com `gap-2`; botões viram ícone-only ou largura total no mobile.
- Grids `lg:grid-cols-2/3` já têm fallback para 1 coluna — auditar e corrigir onde houver `grid-cols-X` fixo.
- Tabelas grandes ganham wrapper `overflow-x-auto` ou versão `<Card>` em `md:hidden`, conforme o caso.
- Tabs com muitos itens passam a rolar horizontalmente (`overflow-x-auto` + `flex-nowrap`) ou usam `flex-wrap h-auto`.
- Diálogos (`Dialog`/`Sheet`) recebem `max-h-[90vh] overflow-y-auto` e `w-[95vw]` quando necessário.
- Filtros em linha viram `flex-col md:flex-row` com inputs `w-full`.
- Padding do `<main>` do AppLayout: `p-4 md:p-6` (hoje é `p-6` fixo) para ganhar espaço no mobile.

## Mudanças por área

### 1. Dashboard (`src/pages/Dashboard.tsx` + widgets)
- Header já tem `flex-wrap`; Select do professor vira `w-full sm:w-[220px]`.
- `StatsCards` em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Widgets com tabelas internas (Pipeline, Plans, AdminAlerts) ganham `overflow-x-auto`.

### 2. Tarefas — Central de Tarefas (`src/pages/TaskCenter.tsx`)
- Filtros e tabs em coluna no mobile; cards com truncamento de nomes longos e botões em `flex-wrap`.

### 3. Notificar (`src/pages/Notificar.tsx`, `NotificacaoChatDock`, `NotificacaoChatWindow`)
- Chat dock: `width` `min(360px, calc(100vw - 16px))` e `height` `calc(100dvh - 80px)`.
- Lista + detalhe em stack vertical no mobile.

### 4. Comissionamentos (`src/pages/Comissionamentos.tsx`)
- Tabela com `overflow-x-auto`; KPIs em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; filtros em coluna.

### 5. Agenda de Serviços (`src/pages/Agenda.tsx`)
- Reduzir `min-w` do grid para `720px` e diminuir font-size no mobile.
- Toolbar com `flex-wrap`; labels de botões `hidden sm:inline`.

### 6. Banco de Treinos (`src/pages/BancoTreinos.tsx`)
- Grid de treinos `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`; diálogos com `max-h-[90vh] overflow-y-auto`.

### 7. Banco de Exercícios (`src/pages/ExerciseBank.tsx`)
- Cards em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; filtros em coluna.

### 8. Avaliações (`src/pages/Avaliacoes.tsx`)
- Cards mobile (`md:hidden`) + tabela (`hidden md:table`); header de aluno empilha no mobile.

### 9. Avaliações Premium (`src/pages/AvaliacoesPremium.tsx` + tabs)
- Tabs com scroll horizontal; `AlunoSidebarCard` empilha acima do conteúdo; `PremiumBodyMap` SVG `max-w-full h-auto`.

### 10. Carteira de Alunos (`src/pages/CarteiraAlunos.tsx`)
- Filtros em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; tabela com `overflow-x-auto` + versão card no mobile.

### 11. Cadastros (`src/pages/StudentList.tsx`, `StudentProfile.tsx`)
- StudentList: cards mobile + tabela desktop.
- StudentProfile: tabs com scroll horizontal; grids internos `grid-cols-1 md:grid-cols-2`.

### 12. Clube Fortem (`src/pages/Clube.tsx`, `AdminClube.tsx`)
- Tabelas com `overflow-x-auto`; cards de membership/QR `max-w-sm mx-auto`; KPIs em grid responsivo.

### 13. Ponto (`src/pages/Ponto.tsx`, `PontoEquipe.tsx`, `PontoFechamento.tsx`, `RelatorioPonto.tsx`, `AdminPonto.tsx`)
- `Ponto`: cards de status (BotaoInteligente, StatusJornadaCard, ResumoDoDia, JanelasDoDia) empilham em 1 coluna no mobile.
- `PontoEquipe`: `EquipeAoVivoTable` + `DashboardCoordenadorKPIs` com `overflow-x-auto` na tabela; KPIs em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- `PontoFechamento` e `RelatorioPonto`: tabelas com wrapper `overflow-x-auto`; filtros em coluna no mobile; menus de exportação ícone-only.
- `AdminPonto`: TabsList já é `flex-wrap`; auditar tabelas internas (`AdminPontoHorarios`, `AdminPontoLocais`, `AdminPontoFeriados`, `AdminPontoFerias`, `AdminPontoVinculos`, `AdminSubstituicoes`, `AdminAtividadesEspeciais`, `AdminAcordosIntervalo`, `AdminBancoHorasTable`) para `overflow-x-auto` e grids de formulário em `grid-cols-1 md:grid-cols-[…]`.

### 14. Pipeline (`src/pages/Pipeline.tsx` + componentes)
- Kanban (`PipelineKanban`) já é horizontal — garantir `overflow-x-auto` com `snap-x` opcional e largura mínima de coluna `w-72`.
- Toolbar (filtros + ações + "Gerenciar Estágios") com `flex-wrap`; botões com label `hidden sm:inline`.
- `StudentPipelinePanel`, `PipelineHistoryTimeline` e diálogos (`ScheduleTaskDialog`, `MarkLostDialog`, `ConvertToAlunoDialog`, `PipelineMetadataDialog`, `ManageStagesDialog`) com `max-h-[90vh] overflow-y-auto` e `w-[95vw] sm:max-w-lg`.

### 15. Leads (`src/pages/Leads.tsx` + componentes)
- `LeadProspectFilters` em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Tabela de leads com `overflow-x-auto` + cards no mobile (`md:hidden`).
- Diálogos (`NewLeadDialog`, `EditLeadDialog`, `ConvertToProspectDialog`, `ManageOrigensDialog`) com `w-[95vw] max-h-[90vh] overflow-y-auto`.

### 16. Prospects (`src/pages/Prospects.tsx`)
- Mesmo padrão de Leads: filtros responsivos, tabela com `overflow-x-auto` + versão card; `NaoConversaoDialog` ajustado.

### 17. Relatórios (`src/pages/relatorios/*` + `RelatoriosLayout`, `KpiCard`, `PeriodoFilter`, `ExportMenu`)
- `RelatoriosLayout`: sub-nav lateral vira tabs com scroll horizontal no mobile (`md:flex-col`).
- `PeriodoFilter` em coluna no mobile (`flex-col md:flex-row`); inputs `w-full md:w-auto`.
- KPIs em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Páginas (`Financeiro`, `Vendas`, `Cancelamentos`, `Planos`, `Servicos`, `Index`, `EmBreve`): tabelas com `overflow-x-auto`; gráficos com `w-full` e `ResponsiveContainer` (auditar).
- `ExportMenu` ícone-only no mobile.

### 18. Anexos Jurídicos (`src/pages/AnexosJuridicos.tsx`, `LegalAnnexFlow.tsx` + `legal-annex/*`)
- `AnexosJuridicos`: lista/tabela com `overflow-x-auto` + cards mobile; filtros em coluna.
- `LegalAnnexFlow`: container `max-w-2xl mx-auto px-4`; `ProgressBar`, `StudentDataForm`, `MedicalEvaluation`, `ImageAuthorization`, `TermsScroller`, `SignaturePad` com larguras `w-full` e padding `p-4 md:p-6`.
- `AnnexDetailModal`: `w-[95vw] max-h-[90vh] overflow-y-auto`.
- `SignaturePad`: canvas `w-full max-w-full`, altura fixa em `h-40`.

### 19. Admin (`src/pages/Admin.tsx` + `admin/*`)
- `Admin`: TabsList já é `flex-wrap`; manter.
- `AdminUsers`, `AdminPlanos`, `AdminServicos`, `AdminTiposAvaliacao`: tabelas com `overflow-x-auto`; formulários em `grid-cols-1 md:grid-cols-2`.
- Diálogos `TipoAvaliacaoDialog` e `ProtocoloAvaliacaoDialog` com `w-[95vw] max-h-[90vh] overflow-y-auto`.

### 20. Presenças (`src/pages/Presencas.tsx`)
- Filtros (data, atividade, busca) em `flex-col md:flex-row` com `w-full md:w-auto`.
- Lista de presença: tabela com `overflow-x-auto` ou cards no mobile mostrando nome do aluno + checkbox de presença.
- Botões de ação (salvar, exportar) em `flex-wrap` com `w-full sm:w-auto`.

## Detalhes técnicos

- Breakpoints Tailwind padrão: `sm` 640, `md` 768, sem novas customizações.
- Não alterar regras de negócio, queries, RLS, schemas, contextos ou rotas.
- Não alterar tokens de cor nem fontes — apenas classes utilitárias.
- AppLayout: `<main className="flex-1 overflow-auto p-4 md:p-6">`.
- Para tabelas convertidas em cards no mobile, manter a tabela como `hidden md:table` e adicionar `<div className="md:hidden space-y-2">…</div>` com os mesmos dados.

## Fora do escopo

- Refatoração de componentes além das classes de layout.
- Mudanças de design system (cores, fontes, sombras).
- Novas funcionalidades, novos filtros ou reorganização de informação.
- Portal do aluno (`/portal/*`).

## Verificação

Após cada bloco: `bun run build` e inspeção visual a 375px e 768px via Playwright nas rotas afetadas, capturando screenshots para validação.
