## Objetivo

Em **Perfil do Aluno → Resumo**, adicionar um bloco **"Trajetória do aluno"** com 4 marcos cronológicos, todos editáveis (para corrigir datas passadas). A edição atualiza a fonte usada pelos dashboards de Leads e Prospects, fazendo as mudanças refletirem automaticamente.

## Marcos exibidos

| Marco | Origem da data |
|---|---|
| Data de Lead | `pipeline_movements.moved_at` para o estágio **"Novo lead"** (fallback: `alunos.created_at`) |
| Data de Conversão para Prospect | `pipeline_movements.moved_at` para **"Prospect"** |
| Data de Agendamento do Treino Experimental | `pipeline_movements.moved_at` para **"Treino experimental agendado"** |
| Data de Conversão para Aluno | `pipeline_movements.moved_at` para **"Aluno ativo"** |

Cada marco mostra a data formatada (dd/MM/yyyy) ou "—" se não houver. Coordenador/admin vê um ícone de lápis ao lado para editar (calendário popover, igual ao já usado para "Data Final" do plano).

## Por que isso já reflete nos dashboards

- **Leads page** (`src/pages/Leads.tsx`) calcula leads/conversões agregando `pipeline_movements` por `moved_at`.
- **Prospects page** (`src/pages/Prospects.tsx`) usa `pipeline_movements.moved_at` para `conversoesMensais` e `origemHistorico`.

Como editamos a fonte (`moved_at`), os widgets recalculam ao revisitar/invalidar. Vamos invalidar as queries dessas páginas após salvar.

## Implementação

### 1. Migração — permitir edição de `pipeline_movements`

Hoje só existem políticas de SELECT/INSERT. Adicionar:

```sql
CREATE POLICY "Coord/admin can update movements"
  ON public.pipeline_movements FOR UPDATE TO authenticated
  USING (is_coordinator_or_admin(auth.uid()))
  WITH CHECK (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can insert movements (manual edit)"
  -- (a política existente de INSERT já cobre, manter)
```

(Sem alterar tabelas ou colunas.)

### 2. `src/components/student/StudentSummary.tsx`

- Nova query `trajectory` que busca:
  - IDs dos 4 estágios em `pipeline_stages` (cacheado).
  - `pipeline_movements` desse aluno filtrado por esses `to_stage_id`, pega o **primeiro** `moved_at` por estágio (`order moved_at asc`).
- Renderizar nova seção `Trajetória` (4 cards em grid 2/4 cols) entre "Plano" e "Serviços" — ícone `Footprints`/`Route`.
- Para coord/admin: cada card tem `Popover` + `Calendar` para editar a data.
  - Se já existe `pipeline_movements`: `UPDATE moved_at`.
  - Se não existe: `INSERT` em `pipeline_movements` com `aluno_id`, `to_stage_id`, `moved_at`, `moved_by_user_id=auth.uid()`, `source='manual'`, `notes='Ajuste manual de data'`.
  - Para o marco "Data de Lead" sem movimento, fallback ao `alunos.created_at` (e edição cria o movimento "Novo lead" com a data escolhida).
- Após salvar: `toast.success` + `queryClient.invalidateQueries` para:
  - `["trajectory", student.id]`
  - `["dashboard-leads-mensais"]`, `["leads-stats"]`, `["prospects-conversoes"]`, `["origem-historico"]` (chaves usadas pelas páginas — confirmaremos os nomes ao codar).

## Fora de escopo

- Não criar tabela nova; reutilizamos `pipeline_movements`.
- Não alterar lógica de comissionamento ou agenda.
- Edição de marcos restrita a coordenador/admin (consistente com edição de plano).