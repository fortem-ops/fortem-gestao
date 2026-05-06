# Plano: Módulos Leads e Prospects integrados ao Pipeline

## Conceito-chave: registro único

Hoje o sistema já tem **um único cadastro de pessoa** na tabela `alunos`, que é também usada pelo Pipeline (cada aluno tem `current_pipeline_stage_id`). Vamos manter exatamente esse modelo: **Lead, Prospect e Aluno são o mesmo registro** em `alunos`, diferenciados apenas pela etapa em que estão no pipeline.

- **Lead** = aluno na etapa "Novo lead"
- **Prospect** = aluno na etapa "Prospect"
- **Converter em Prospect** = mover do "Novo lead" para "Prospect" + completar campos adicionais

Sem tabela nova de pessoas. Sem duplicidade. Histórico de movimentação já existe em `pipeline_movements`.

---

## 1. Mudanças de banco

### 1.1. Ampliar `alunos`
Adicionar colunas que hoje não existem mas o spec exige:
- `sexo` (text) — "masculino" | "feminino" | "outro" | "nao_informar"

Os demais campos do Lead/Prospect já existem em `alunos` (nome, telefone, email, data_nascimento) ou em `pipeline_metadata` (origem_lead).

### 1.2. Padronizar opções de origem
Atualizar a lista `ORIGEM_OPTIONS` no app (frontend) para o conjunto exato pedido:
`Indicação`, `Fachada`, `Instagram`, `Ex-aluno`, `Gympass/Wellhub`, `Total Pass`, `Parceiros`.

Não precisa mudar o tipo da coluna (já é `text`).

### 1.3. Nova tabela `prospect_anamnese`
Para os 3 campos de anamnese inicial do Prospect:
- `aluno_id` (uuid, único — 1:1)
- `limitacoes` (text)
- `atividade_fisica` (text)
- `objetivo_treinamento` (text)

RLS: visível para autenticados; insert/update por coord/admin ou pelo `responsavel_id` do aluno.

### 1.4. RPC `fn_convert_lead_to_prospect`
Função que recebe `_aluno_id` e:
1. Atualiza dados complementares do aluno (sexo, data_nascimento, email se informados)
2. Faz upsert de `prospect_anamnese`
3. Chama `fn_move_pipeline` para mover para a etapa "Prospect" (com `_source = 'manual'`, registrando `moved_by_user_id` para histórico)

Manter `pipeline_movements` é o histórico da conversão (já existe).

### 1.5. Automação "Treino experimental agendado"
Trigger em `agenda_servicos`: quando uma agenda é criada com `tipo = 'experimental'` (ou `atividade ILIKE '%experimental%'`) vinculada a um `aluno_id` que esteja em "Prospect", mover automaticamente para a etapa "Treino experimental agendado".

---

## 2. Frontend — novos módulos

### 2.1. Página `/leads` (`src/pages/Leads.tsx`)
**Captura ultrarrápida** (foco em <15s):
- Header com botão grande "+ Novo Lead" abrindo um Dialog enxuto:
  - Nome completo (obrigatório)
  - Telefone (obrigatório, com máscara BR)
  - Como conheceu (Select com as 7 opções)
- Ao salvar:
  - `INSERT alunos { nome, telefone, status: 'lead' }`
  - `INSERT pipeline_metadata { aluno_id, origem_lead }`
  - `RPC fn_move_pipeline` para "Novo lead"
- Tabela de leads (alunos cuja etapa atual é "Novo lead"):
  - Colunas: Nome · Telefone · Origem · Responsável · Criado em · Ações
  - Ações por linha: **Editar** (mesmo dialog), **Converter em Prospect** (abre dialog 2.3), **WhatsApp** (reusa `waMeLink`), **Abrir no Pipeline**
- Filtros: origem, data de cadastro (range), responsável
- Cards de indicadores no topo: **Total de leads**, **Leads por origem** (mini barras)

### 2.2. Página `/prospects` (`src/pages/Prospects.tsx`)
- Tabela de prospects (alunos cuja etapa atual é "Prospect" ou estágios posteriores configuráveis — por padrão apenas "Prospect" e "Treino experimental agendado")
- Colunas: Nome · Telefone · Origem · Status no pipeline · Agendamento (sim/não) · Última interação
- Filtros: status no pipeline, data de cadastro, agendamento (sim/não)
- Indicadores: **Taxa de conversão Lead → Prospect** (movimentos com from = "Novo lead" / total leads no período), **Origem dos prospects** (mini barras)
- Ações por linha: **Editar dados**, **Agendar experimental** (abre `AddAgendaDialog` pré-preenchido), **Nova tarefa** (follow-up), **Abrir no Pipeline**

### 2.3. `ConvertToProspectDialog` (`src/components/leads/ConvertToProspectDialog.tsx`)
Aberto a partir do Lead. Traz pré-preenchidos os campos já existentes (nome, telefone, origem) e pede o restante:
- Data de nascimento
- Email
- Sexo
- Confirma/edita "Como conheceu"
- **Anamnese inicial** (3 campos texto):
  - Limitações de movimento, patologias, dores ou lesões
  - Atividade física atual / tempo parado
  - Objetivo com o treinamento funcional

Ao confirmar: chama `fn_convert_lead_to_prospect`. Toast de sucesso e navegação opcional para o Pipeline.

### 2.4. Timeline de contato (reaproveitar)
Já existe `PipelineHistoryTimeline.tsx` baseado em `pipeline_movements`. Vamos reusá-la dentro de um Dialog "Histórico" acessível na linha de cada Lead/Prospect.

### 2.5. Integração visual com o Pipeline
- Botão "Abrir no Pipeline" leva para `/pipeline?focus={aluno_id}` (ou simplesmente `/pipeline`)
- Drag-and-drop continua funcionando no Pipeline existente (Lead → Prospect via DnD também dispara movimento; nesse caso a conversão é sem anamnese — adicionamos no card de Prospect um aviso "Completar anamnese" se ainda não existir)

### 2.6. Roteamento e sidebar
- Adicionar rotas `/leads` e `/prospects` em `src/App.tsx` (lazy)
- Adicionar itens no `AppSidebar.tsx` no grupo Principal (com ícones `UserPlus` e `Target`), logo acima de "Pipeline"

---

## 3. Estrutura de arquivos (novos)

```text
src/pages/
  Leads.tsx
  Prospects.tsx
src/components/leads/
  NewLeadDialog.tsx
  EditLeadDialog.tsx
  ConvertToProspectDialog.tsx
  LeadsTable.tsx
  LeadsKPIs.tsx
src/components/prospects/
  ProspectsTable.tsx
  ProspectsKPIs.tsx
  ProspectAnamneseDialog.tsx
src/lib/
  leads.ts            (helpers: createLead, convertToProspect, fetchKPIs)
```

Arquivos editados:
- `src/App.tsx` — rotas
- `src/components/AppSidebar.tsx` — itens
- `src/components/pipeline/PipelineMetadataDialog.tsx` — alinhar `ORIGEM_OPTIONS`

---

## 4. Detalhes técnicos

- **Sem duplicação**: criação de Lead checa por telefone normalizado (`replace(/\D/g, "")`); se já existir aluno com mesmo telefone, oferecemos "Abrir cadastro existente" em vez de criar.
- **Status de aluno**: usaremos a coluna `alunos.status` com valores `'lead'`, `'prospect'`, `'ativo'` (já é text livre hoje). A etapa do pipeline continua sendo a fonte de verdade; `status` é apenas um espelho conveniente atualizado pelos RPCs.
- **Histórico de conversão**: já registrado em `pipeline_movements` (`moved_by_user_id`, `moved_at`, `from_stage_id`, `to_stage_id`).
- **RLS**: as tabelas tocadas (`alunos`, `pipeline_metadata`, `pipeline_movements`) já têm políticas adequadas. A nova `prospect_anamnese` recebe políticas equivalentes às de `pipeline_metadata`.
- **Permissões**: criação de Lead permitida para qualquer autenticado responsável (mesma regra atual de `alunos`). Conversão para Prospect também.

---

## 5. Ordem de execução (após aprovação)

1. Migration: coluna `sexo`, tabela `prospect_anamnese`, RPC `fn_convert_lead_to_prospect`, trigger experimental.
2. Helpers em `src/lib/leads.ts`.
3. Página `/leads` + dialogs.
4. Página `/prospects` + dialogs.
5. Sidebar + rotas.
6. Ajuste fino do `PipelineMetadataDialog` (origens).
