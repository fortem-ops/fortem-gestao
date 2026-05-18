## Objetivo

Permitir que Coordenadores/Administradores criem, editem e excluam **tipos de avaliação** e **protocolos** (variantes nomeadas) dentro de cada tipo. Funcional e Composição Corporal mantêm suas telas atuais com cálculos automáticos, mas passam a aceitar seleção de protocolo. Pliometria, Força e Experimental são totalmente dinâmicos (schema editável).

## 1. Modelo de dados

### 1.1 Generalizar `avaliacao_templates` em `avaliacao_tipos` + `avaliacao_protocolos`

```sql
-- Tipos de avaliação (Funcional, Composição, Pliometria, Força, Experimental, ou novos)
create table public.avaliacao_tipos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,             -- 'funcional', 'composicao_corporal', 'pliometria', 'forca', 'experimental', ...
  nome text not null,
  engine text not null default 'dinamico', -- 'funcional_fixo' | 'composicao_pollock' | 'dinamico'
  icone text,
  ordem int not null default 0,
  ativo boolean not null default true,
  is_sistema boolean not null default false, -- tipos sistema não podem ser excluídos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Protocolos (variantes nomeadas dentro de um tipo)
create table public.avaliacao_protocolos (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references public.avaliacao_tipos(id) on delete cascade,
  nome text not null,                    -- "Pollock 7 Dobras", "Pollock 3", "FMS Adaptado"...
  descricao text,
  schema jsonb not null default '{}',    -- para engine='dinamico': sections/questions
                                         -- para engines fixos: config (ex: { metricas: [...] })
  is_default boolean not null default false,
  ativo boolean not null default true,
  ordem int not null default 0,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_id, nome)
);
```

RLS: `SELECT` para `authenticated`; `INSERT/UPDATE/DELETE` apenas via `is_coordinator_or_admin(auth.uid())`. Tipos com `is_sistema = true` não podem ser deletados (trigger).

**Seed inicial:** 5 tipos sistema (Funcional/Composição/Pliometria/Força/Experimental) e um protocolo padrão para cada. Migra o `schema` atual de `avaliacao_templates` (`tipo='experimental'`) para o protocolo padrão de Experimental.

### 1.2 Vincular avaliações ao protocolo usado

```sql
alter table public.avaliacoes add column protocolo_id uuid references public.avaliacao_protocolos(id);
```
Permanece nulável para histórico antigo. Permite renderizar respostas conforme o schema do protocolo da época.

## 2. UI — Admin → "Tipos de Avaliação"

Nova rota/aba acessível por Coord/Admin: `Admin → Tipos de Avaliação`.

**Layout (2 colunas):**

```text
┌─────────────────────────────┬─────────────────────────────────────┐
│  Tipos                      │  Protocolos de [Tipo selecionado]   │
│  ────                       │  ───────                            │
│  [+] Novo tipo              │  [+] Novo protocolo                 │
│  • Funcional       ✏ 🗑    │  • Pollock 7    (padrão) ✏ 🗑     │
│  • Composição      ✏ 🗑    │  • Pollock 3              ✏ 🗑     │
│  • Pliometria      ✏ 🗑    │                                     │
│  • Força           ✏ 🗑    │  [Editor de schema do protocolo →]  │
│  • Experimental    ✏ 🗑    │                                     │
└─────────────────────────────┴─────────────────────────────────────┘
```

**Editor de tipo (dialog):** nome, slug (somente em criação), engine (`dinamico | funcional_fixo | composicao_pollock`), ícone, ordem, ativo. Tipos `is_sistema` não permitem trocar slug/engine.

**Editor de protocolo:**
- Cabeçalho: nome, descrição, marcar como padrão, ativo.
- Se engine = **dinamico**: usa o editor já existente `ExperimentalTemplateEditor` (renomeado para `DynamicSchemaEditor`) — seções, perguntas, tipos `sim_nao | sim_nao_detalhe | sim_nao_numero | sim_nao_dupla | texto | numero | opcoes`.
- Se engine = **funcional_fixo**: editor de "métricas" — lista de itens (label, coluna, faixas de classificação) sobre a base atual de `functionalMetrics` + `assessmentReferences`. Permite ocultar/reordenar e adicionar métrica extra (não persistida em `avaliacao_funcional`; salva em `dados.extras`).
- Se engine = **composicao_pollock**: editor de "dobras" — selecionar quais dobras compõem o somatório (3, 7, 9...) e qual fórmula (Pollock-3 M/F, Pollock-7 M/F, Jackson). Recálculo automático ao avaliar.

## 3. Fluxo de avaliação (`/avaliacoes`)

Ao clicar **Nova Avaliação**:
1. Selecionar **tipo** (lista de `avaliacao_tipos` ativos).
2. Selecionar **protocolo** (lista de `avaliacao_protocolos` ativos do tipo; pré-seleciona o padrão).
3. Renderiza o formulário conforme `engine`:
   - `funcional_fixo` → `FunctionalAssessment` (atual) lendo lista de métricas do protocolo.
   - `composicao_pollock` → `BodyComposition` (atual) usando fórmula/dobras do protocolo.
   - `dinamico` → `DynamicAssessment` (extraído de `ExperimentalAssessment`, recebendo `schema` por prop).
4. Persiste em `avaliacoes` com `tipo = tipos.slug`, `protocolo_id`, `dados`.

## 4. Visualização (`AssessmentViewerDialog`)

- Carrega o protocolo via `avaliacao.protocolo_id` (fallback: protocolo padrão do `tipo`).
- Renderiza dinamicamente com `renderAnswerSummary` (já existe) para engines dinâmicos; mantém renderização atual para Funcional/Composição.
- Botões Editar/Excluir continuam para Coord/Admin (RLS já cobre).

## 5. Permissões

- **Visualizar** tipos/protocolos: qualquer autenticado.
- **Criar/editar/excluir** tipos e protocolos: Coord/Admin (RLS).
- **Excluir tipo `is_sistema`**: bloqueado (trigger).
- **Excluir protocolo em uso**: soft-delete (`ativo=false`); manter histórico funcional.

## 6. Arquivos

**Migration**
- Cria `avaliacao_tipos`, `avaliacao_protocolos`, coluna `avaliacoes.protocolo_id`, policies, seed dos 5 tipos sistema + protocolos padrão (incluindo migração do schema experimental atual).

**Novos**
- `src/components/admin/AdminTiposAvaliacao.tsx` — lista tipos + protocolos (2 colunas).
- `src/components/admin/TipoAvaliacaoDialog.tsx` — criar/editar tipo.
- `src/components/admin/ProtocoloAvaliacaoDialog.tsx` — criar/editar protocolo (delega editor por engine).
- `src/components/student/assessment/DynamicSchemaEditor.tsx` — generalização do `ExperimentalTemplateEditor` (recebe schema/onChange).
- `src/components/student/assessment/FuncionalProtocoloEditor.tsx` — métricas/faixas.
- `src/components/student/assessment/ComposicaoProtocoloEditor.tsx` — dobras/fórmula.
- `src/components/student/assessment/DynamicAssessment.tsx` — generalização do `ExperimentalAssessment` (recebe `protocolo`/`schema`).
- `src/lib/avaliacaoProtocolos.ts` — fetch/save tipos & protocolos.

**Editados**
- `src/pages/Admin.tsx` — adiciona aba "Tipos de Avaliação" (Coord/Admin).
- `src/pages/Avaliacoes.tsx` — passa a oferecer escolha de tipo + protocolo antes do formulário.
- `src/components/student/assessment/AssessmentForm.tsx` — refatora para dispatcher por `engine`, lendo o protocolo escolhido. Mantém `FunctionalAssessment`/`BodyComposition` adaptadas para receber config do protocolo.
- `src/components/student/assessment/AssessmentViewerDialog.tsx` — resolve schema via `protocolo_id`.
- `src/components/student/assessment/ExperimentalAssessment.tsx` — vira wrapper fino sobre `DynamicAssessment` para retro-compatibilidade.

## 7. Observações

- Autosave (debounce 800ms) e fluxo finalizar/reabrir preservados nos dinâmicos.
- IDs de pergunta gerados (`crypto.randomUUID()`) e imutáveis — preserva respostas históricas.
- Respostas órfãs (pergunta removida do protocolo) são exibidas no viewer como "(pergunta removida)".
- Tipos do TS para Supabase serão regenerados após a migration.
