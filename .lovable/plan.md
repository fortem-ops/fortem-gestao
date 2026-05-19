
# Módulo Comissionamentos — Fase 1

Entrega: estrutura de dados, automação das 3 regras de comissão, dashboard com cards e meta da carteira, listagem administrativa, pendências.
**Fora desta fase:** export PDF/Excel/CSV, notificações por e-mail, ranking mensal, gráficos avançados.

## 1. Banco de dados

### Tabelas novas
- **`comissionamento_config`** — parâmetros editáveis pelo admin:
  - `tipo` (`treino_experimental` | `avaliacao_funcional` | `carteira_ativa`)
  - `valor` (numeric), `ativo` (bool), `meta_minima` (int, p/ carteira)
  - Seed: 30, 35, 5 (meta 150).
- **`comissionamentos`**: `id`, `tipo`, `profissional_id`, `aluno_id` (nullable p/ carteira), `origem_tabela`, `origem_id`, `valor`, `status` (`pendente` | `em_validacao` | `aprovado` | `pago` | `cancelado`), `descricao`, `data_referencia`, `data_pagamento`, `aprovado_por`, `comprovante_url`, `observacoes`, timestamps.
  - **UNIQUE parcial** (`profissional_id`, `aluno_id`, `tipo`, `origem_id`) `WHERE status <> 'cancelado'` — evita duplicidade.
- **`comissionamento_pendencias`**: `id`, `comissionamento_id` (nullable enquanto a comissão não foi gerada), `profissional_id`, `aluno_id`, `tipo_pendencia` (`avaliar_experimental` | `concluir_avaliacao_funcional` | `upload_arquivo_forca` | `aguardando_pagamento_plano`), `descricao`, `agenda_id`/`avaliacao_id` de referência, `concluido` (bool), `concluido_em`, `responsavel_id`.

### RLS
- Professor: SELECT onde `profissional_id = auth.uid()`.
- Coord/Admin: SELECT/UPDATE total.
- Admin: DELETE / INSERT manual.
- `config`: SELECT autenticado; ALL coord/admin.

### Triggers / Funções (PL/pgSQL)

**Helper:** `fn_gerar_comissao(tipo, profissional, aluno, origem_id, descricao)` — insere com `ON CONFLICT DO NOTHING` na UNIQUE acima; busca valor em `comissionamento_config`.

1. **Treino Experimental**
   - Trigger `AFTER INSERT` em `agenda_servicos` quando `atividade ILIKE 'Treino Experimental'` e `aluno_id IS NOT NULL`: cria pendência `avaliar_experimental` para `profissional_id`.
   - Quando essa pendência é marcada `concluido = true` AND existe `vendas` desse aluno com `status_pagamento = 'pago'` AND plano vinculado → chama `fn_gerar_comissao('treino_experimental', ...)`.
   - Trigger `AFTER INSERT/UPDATE` em `vendas`: se `status_pagamento` virar `'pago'` e existir pendência experimental concluída para o mesmo aluno, gera comissão (mesma chave).

2. **Avaliação Funcional**
   - Trigger `AFTER INSERT` em `agenda_servicos` com atividade "Avaliação Funcional": cria pendência `concluir_avaliacao_funcional`.
   - Trigger `AFTER INSERT` em `avaliacoes` com `tipo` "funcional"/protocolo Força: marca pendência anterior como concluída e cria pendência `upload_arquivo_forca`.
   - Trigger `AFTER INSERT` em `avaliacao_anexos`: se a `avaliacao` é Força/Funcional, marca `upload_arquivo_forca` concluída e chama `fn_gerar_comissao('avaliacao_funcional', profissional do agendamento, aluno, avaliacao_id, ...)`.

3. **Carteira mensal (≥150 global)**
   - **Edge function** `comissionar-carteira-mensal` agendada com `pg_cron` no dia 1 de cada mês:
     - Conta `alunos` com `status='ativo'`, plano ativo com `tipo NOT IN ('Gympass/Wellhub','Total Pass')`, sem `aluno_licencas` vigente, com `vendas` pagas em dia.
     - **Se total global ≥ 150**, para cada professor com ≥1 aluno qualificado insere comissão `carteira_ativa` valor = `qtd × 5`, `data_referencia = primeiro dia do mês anterior`.

### Cancelamentos automáticos
Triggers que setam `status='cancelado'` em comissões existentes quando:
- `vendas` atualizada para `estornado`/`cancelado`;
- `planos.ativo` muda para `false`;
- `avaliacoes` deletada;
- `agenda_servicos` deletado.

## 2. Frontend

Rota nova `/comissionamentos` (lazy) + item no `AppSidebar` (grupo **Principal**, ícone `DollarSign`, visível para todos os perfis staff).

Página com `<Tabs>`:

1. **Dashboard**
   - Cards: Comissão do mês / Pendente / Paga / Conversões do mês / Avaliações concluídas.
   - Card **Meta da carteira** com barra de progresso (atual × 150) e bonificação estimada.
   - Professor vê só seus dados; Coord/Admin pode filtrar por profissional.
2. **Pendências** — lista das suas pendências em aberto (botão "Marcar como concluída" quando aplicável; experimental conclui via essa tela).
3. **Histórico** — tabela de comissões do usuário com filtros por período/tipo/status.
4. **Carteira de Alunos** — lista detalhada dos alunos qualificados/não-qualificados (motivo da exclusão).
5. **Configurações** (admin) — editar valores e meta em `comissionamento_config`.
6. **Listagem Admin** (coord/admin) — tabela completa com ações Aprovar / Marcar como pago / Cancelar / Lançar manualmente.

Widget **"Meta da carteira"** também adicionado ao `Dashboard.tsx` existente (compacto, visível ao professor).

Hooks novos: `useComissionamentos`, `useComissionamentoPendencias`, `useCarteiraMeta` (React Query, `staleTime 60s`).

## 3. Arquivos

**Migrations**
- `supabase/migrations/<ts>_comissionamentos.sql` (tabelas, RLS, índices, funções, triggers, seed config).
- `supabase/migrations/<ts>_comissionamentos_cron.sql` (agendamento mensal — usar `supabase--insert` por conter URL/anon key).

**Edge function**
- `supabase/functions/comissionar-carteira-mensal/index.ts`.

**Código**
- `src/pages/Comissionamentos.tsx`
- `src/components/comissionamentos/` — `DashboardTab.tsx`, `PendenciasTab.tsx`, `HistoricoTab.tsx`, `CarteiraTab.tsx`, `ConfigTab.tsx`, `AdminListTab.tsx`, `MetaCarteiraCard.tsx`, `ComissaoStatusBadge.tsx`.
- `src/hooks/useComissionamentos.ts`
- `src/lib/comissionamentos.ts` (tipos, helpers, formatBRL).
- `src/App.tsx` (rota), `src/components/AppSidebar.tsx` (menu), `src/pages/Dashboard.tsx` (widget meta).

## Pontos confirmados
- Pagamento = registro em `vendas` com `status_pagamento='pago'` (tabela já existente).
- Profissional comissionado = `profissional_id` do `agenda_servicos`.
- Carteira: snapshot mensal automático; gatilho só dispara se total **global** de alunos ativos ≥ 150; cada professor recebe `qtd_ativos_próprios × R$5`.
- Planos `Gympass/Wellhub` e `Total Pass` excluídos da contagem da carteira.
