## Visão geral

Hoje o Pipeline mostra todas as etapas em um único kanban horizontal. Vamos transformá-lo em **3 funis empilhados verticalmente**, cada um com seu próprio kanban horizontal:

```text
┌─────────────────────────────────────────────────────────────┐
│ FUNIL 1 · PROSPECTS                                         │
│ Novo lead → Info encaminhadas → Agendando → Treino exp.     │
│   → Follow Up → [Conversão] / [Perdido]                     │
├─────────────────────────────────────────────────────────────┤
│ FUNIL 2 · ALUNO                                             │
│ Aluno ativo → Risco de evasão → Renovação                   │
│   → [Ganho → novo plano] / [Perdido]                        │
├─────────────────────────────────────────────────────────────┤
│ FUNIL 3 · INATIVO                                           │
│ Aluno inativo (15 dias após término do plano)               │
└─────────────────────────────────────────────────────────────┘
```

Cada funil é colapsável (header com nome + contagem total). Drag-and-drop continua funcionando dentro de cada funil; mover entre funis acontece automaticamente via ações específicas (Conversão, Ganho, Perdido) ou regras automáticas existentes.

---

## 1. Banco de dados

**Nova coluna `funnel` em `pipeline_stages`** (enum: `prospects` | `aluno` | `inativo`).

Backfill das etapas atuais:
- `prospects`: Novo lead, Informações encaminhadas, Agendando, Treino experimental agendado, Avaliação agendada/confirmada/realizada, Follow Up, Prospect
- `aluno`: Aluno ativo, Risco de evasão, Renovação de plano (nova)
- `inativo`: Aluno inativo

**Novas etapas criadas (se faltarem):** `Agendando`, `Renovação de plano`.

**Nova coluna `motivo_perda` em `alunos`** (text, nullable) para registrar motivo quando marcado como Perdido.

**Atualizar `fn_detect_evasao`** para também mover automaticamente para `Aluno inativo` quando passados 15 dias do término do último plano (hoje só move para Risco/Recuperado). Renovação entra quando faltam ≤15 dias para o fim do plano e o aluno ainda não renovou.

---

## 2. Página Pipeline (`src/pages/Pipeline.tsx`)

Renderizar 3 `<PipelineKanban funnel="prospects|aluno|inativo">`, cada um dentro de uma seção colapsável com título, ícone e contagem. Filtros (busca, professor, origem) ficam globais no topo e se aplicam aos 3.

---

## 3. `PipelineKanban` (refatorado)

- Recebe `funnel` como prop. Busca apenas as `pipeline_stages` daquele funil.
- Filtra alunos cujo `current_pipeline_stage_id` pertence ao funil.
- Mantém drag-and-drop atual entre etapas do mesmo funil.

---

## 4. Ações de Conversão / Ganho / Perdido

Botões aparecem em `PipelineCard` quando o aluno está em etapa-chave:

- **Etapa "Follow Up" (Prospects):** botões `Converter` e `Perdido`.
- **Etapa "Renovação de plano" (Aluno):** botões `Ganho` e `Perdido`.

### Diálogo "Converter para Aluno" (`ConvertToAlunoDialog.tsx`)

Pré-preenche dados do prospect e exige:
- CPF (com máscara/validação)
- Email
- Endereço completo: CEP (consulta **ViaCEP** `https://viacep.com.br/ws/{cep}/json/` para autopreencher logradouro/bairro/cidade/UF), número, complemento
- Plano (seletor de planos ativos com data início/fim)

Ao salvar: atualiza `alunos` (cpf, email, endereço — campos a adicionar se não existirem), cria registro em `planos`, e chama `fn_move_pipeline` para `Aluno ativo` (Funil 2). Invalida queries.

### Diálogo "Ganho — novo plano" (mesmo padrão, só plano)
Cria novo `planos` e move para `Aluno ativo`.

### Diálogo "Marcar como Perdido"
Campo obrigatório `motivo` (textarea + sugestões: "Sem retorno", "Preço", "Concorrente", "Mudou de cidade", "Outro"). Grava `alunos.motivo_perda` e move para etapa terminal `Aluno perdido` (Prospects) ou `Aluno inativo` (Aluno).

---

## 5. Endereço dos alunos

Adicionar colunas em `alunos` (se ainda não existirem): `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`. Usadas pela conversão e exibidas no perfil do aluno.

---

## 6. `ManageStagesDialog` — selecionar funil

Cada linha de etapa ganha um seletor (`Select`) com 3 opções: **Prospects / Aluno / Inativo**. Ao criar nova etapa, escolher funil também (default: Prospects). A listagem agrupa visualmente as etapas por funil.

---

## 7. `PipelineFilters`

Sem mudanças funcionais — filtros continuam globais e aplicados aos 3 funis simultaneamente.

---

## Arquivos afetados

**Migrations (SQL):**
- Adicionar coluna `funnel` em `pipeline_stages` + backfill
- Criar etapas `Agendando` e `Renovação de plano`
- Adicionar colunas de endereço e `motivo_perda` em `alunos`
- Atualizar `fn_detect_evasao` (Inativo após 15 dias, Renovação ≤15 dias para fim)

**Frontend:**
- `src/pages/Pipeline.tsx` — renderizar 3 kanbans empilhados
- `src/components/pipeline/PipelineKanban.tsx` — aceitar prop `funnel`
- `src/components/pipeline/PipelineCard.tsx` — botões contextuais Converter/Ganho/Perdido
- `src/components/pipeline/ManageStagesDialog.tsx` — seletor de funil por etapa
- **Novos:** `ConvertToAlunoDialog.tsx`, `MarkLostDialog.tsx`, `RenewPlanDialog.tsx`
- `src/lib/pipeline.ts` — constantes `FUNNELS` e helpers
- `src/lib/viacep.ts` (novo) — fetch ViaCEP

---

## Observações

- Migração preserva todos os alunos e movimentos existentes — só reorganiza visualmente.
- O scan de evasão já existente passa a mover Risco→Inativo após 15 dias do fim do plano.
- Os 3 funis usam o mesmo `fn_move_pipeline` (não muda RPC).
- Cards mantêm o indicador de tarefas (verde/vermelho/cinza/amarelo) já implementado.
