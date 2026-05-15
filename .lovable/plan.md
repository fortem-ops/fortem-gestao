## 1. Busca global de cadastros no header

Adicionar um campo de busca sempre visível em `src/components/AppLayout.tsx`, ao lado do título "Fortem Gestão Técnica".

**Comportamento:**
- Campo com ícone de lupa, placeholder "Buscar cadastro (lead, prospect, aluno)..."
- Ao digitar (debounce 200ms), abre um popover/dropdown listando os resultados agrupados por tipo:
  - **Leads** (alunos cuja `current_pipeline_stage_id` = "Novo lead")
  - **Prospects** (estágios "Prospect" e "Treino experimental agendado")
  - **Alunos Ativos** (status display = ativo/licenca)
  - **Alunos Inativos** (status display = encerrado)
- Cada item mostra: nome, telefone, badge do tipo
- Atalho de teclado `⌘K` / `Ctrl+K` para focar
- Limite ~8 resultados por grupo

**Navegação ao clicar:**
- **Aluno Ativo/Inativo** → `navigate('/alunos/:id')`
- **Lead** → `navigate('/leads')` + abre `EditLeadDialog` automaticamente via query param (`?edit=:id`)
- **Prospect** → `navigate('/prospects')` + abre `EditLeadDialog` via `?edit=:id`

**Implementação técnica:**
- Novo componente `src/components/GlobalCadastroSearch.tsx` usando `Command` (cmdk) dentro de `Popover`
- Query única em `alunos` (id, nome, telefone, current_pipeline_stage_id, status) + join leve com `pipeline_stages` para classificar; cacheada com `staleTime: 60s`
- Classificação client-side por estágio (Novo lead / Prospect / Treino experimental) e status para separar ativos vs inativos
- `Leads.tsx` e `Prospects.tsx` lerão `useSearchParams` para abrir `EditLeadDialog` quando `?edit=` estiver presente

## 2. Padronizar Leads e Prospects com o padrão Alunos

Criar um componente compartilhado de filtros avançados análogo a `StudentListFilters`, e aplicar a mesma estrutura visual (cards de KPI + barra de filtros + tabela em `glass-card`) nas páginas Leads e Prospects.

### 2.1 Novo componente `src/components/leads/LeadProspectFilters.tsx`

Mesmo padrão de UX de `StudentListFilters`:
- Linha superior: campo de busca + select primário (origem para Leads / etapa para Prospects) + botão **"Filtros"** com ícone `SlidersHorizontal` e badge de contagem ativa
- Painel "Filtros Avançados" colapsável (`glass-card`) com botão **"Limpar filtros"**
- Para **Leads**, o painel contém: Período (sempre/mês atual/mês passado/meses passados/customizado), seletor de mês quando aplicável, datas customizadas, Responsável
- Para **Prospects**, o painel contém: Período (mesmas opções), Etapa, Agendamento (com/sem)

### 2.2 KPIs padronizados (cards superiores)

- **Leads**: Total · Conversão Lead → Prospect (30d) · Leads por Origem (mantém barras horizontais)
- **Prospects**: Total · Conversão Lead → Prospect (30d) · Origem dos Prospects (mantém barras)

Ambos passarão a usar o mesmo grid `grid-cols-1 md:grid-cols-3 gap-3` e mesmo estilo de Card visto em Alunos.

### 2.3 Tabela em `glass-card`

Substituir `Card` + `Table` por `<div class="glass-card rounded-lg overflow-hidden overflow-x-auto">` com `<table>` nativa, no mesmo padrão de `StudentList.tsx`:
- Cabeçalho com `text-xs font-medium text-muted-foreground p-4`
- Linhas com `border-b border-border/50 hover:bg-secondary/50 cursor-pointer`
- Clique em qualquer parte da linha abre o `EditLeadDialog` (em vez de só no botão de editar)
- Colunas mantêm o conteúdo atual de cada página

### 2.4 Refatorações nas páginas

- `src/pages/Leads.tsx`: substitui o bloco atual de filtros por `<LeadProspectFilters mode="leads" .../>`, adapta KPIs ao grid de 3 colunas, troca `Card`+`Table` pela tabela `glass-card`, lê `?edit=` para abrir dialog
- `src/pages/Prospects.tsx`: idem com `mode="prospects"`, mesmas adaptações; mantém a coluna Etapa/Agenda

## Arquivos afetados

- `src/components/AppLayout.tsx` — inserir busca no header
- `src/components/GlobalCadastroSearch.tsx` — novo
- `src/components/leads/LeadProspectFilters.tsx` — novo
- `src/pages/Leads.tsx` — refatorar filtros, KPIs, tabela, suporte `?edit=`
- `src/pages/Prospects.tsx` — refatorar filtros, KPIs, tabela, suporte `?edit=`

## Detalhes técnicos

- A busca global classifica o resultado pelo nome do `pipeline_stages` correspondente ao `current_pipeline_stage_id`. Estágios "Novo lead" → Lead; "Prospect"/"Treino experimental agendado" → Prospect; demais (ou nulos) com `status` ∈ {ativo, licenca} → Aluno Ativo; com `status='encerrado'` → Aluno Inativo. Computado client-side a partir de uma query cacheada de stages.
- O `EditLeadDialog` já existe e aceita `alunoId`; basta acionar via `useSearchParams` no `useEffect` inicial e limpar o param ao fechar.
- Mantém RLS atual (nenhuma migração de banco). Apenas mudanças de frontend/apresentação.
- Sem alteração nas dependências (`cmdk`/`Command` já está disponível via shadcn).
