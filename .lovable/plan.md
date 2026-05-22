## Objetivo

Permitir que professores marquem **presença / falta** por aula (fixa ou avulsa), gravando em `agenda_servicos.comparecimento`, para que a KPI de **Taxa de Comparecimento** em Relatórios > Serviços passe a refletir dados reais.

## Mudanças no banco

Adicionar colunas em `agenda_servicos` para suportar marcação por ocorrência (sem perder o conceito de aula fixa recorrente):

- `comparecimento` (boolean, nullable) — usado direto em aulas avulsas.
- Nova tabela `agenda_presencas` para aulas **fixas**, que se repetem semanalmente:
  - `id`, `agenda_id` (FK lógica), `aluno_id`, `data` (date), `comparecimento` (boolean), `marcado_por`, `marcado_em`, `observacao`.
  - Unique (`agenda_id`, `aluno_id`, `data`) para idempotência.
  - RLS: professor dono da agenda + coord/admin podem inserir/atualizar; todos autenticados podem ler.

A view `v_servicos_agenda` é atualizada para:
- Para `tipo = 'avulso'` → usar `agenda_servicos.comparecimento`.
- Para `tipo = 'fixo'` → expandir ocorrências no período consultado e fazer `LEFT JOIN` com `agenda_presencas` por `(agenda_id, data)`.

## Mudanças no frontend

### 1. Tela de marcação — "Lista de Presença do Dia"
Nova página `src/pages/Presencas.tsx` (rota `/presencas`), acessível a Professor / Nutri / Fisio / Coord / Admin no sidebar (item "Presenças").

Layout:
- Seletor de **data** (default = hoje) + filtro por **profissional** (coord/admin vê todos; professor vê só as próprias).
- Lista agrupada por horário, cada card mostra: atividade, local, aluno, horário, tipo (fixo/avulso).
- 3 botões por linha: ✅ Presente · ❌ Faltou · ⏺ Limpar.
- Estado atual destacado por cor (verde/vermelho/cinza).
- Salva otimisticamente via mutation:
  - Avulso → `update agenda_servicos set comparecimento = ...`
  - Fixo → `upsert agenda_presencas (agenda_id, aluno_id, data, comparecimento)`

### 2. Ação rápida na Agenda existente
Em `src/pages/Agenda.tsx`, no card do evento (semana), adicionar dois mini-botões (✅/❌) visíveis no hover, para permitir marcação direta sem sair da Agenda. Apenas em datas ≤ hoje.

### 3. Relatórios > Serviços
Como a métrica já lê `comparecimento` da view, basta:
- Manter os 4 KPIs (Total, Fixos, Avulsos, Taxa).
- Adicionar uma 5ª linha sutil na KPI: **"X de Y marcadas"** para deixar claro quantas aulas já tiveram presença lançada (evita confusão quando a taxa parece baixa só porque ninguém marcou ainda).
- Excluir do denominador as aulas **futuras** (data > hoje) — só conta aulas que já aconteceram.

## Detalhes técnicos

- View `v_servicos_agenda` precisa receber parâmetros de período (já é chamada com `data_especifica` filter). Para fixos, gerar série com `generate_series(data_inicio, data_fim, '1 week')` filtrando pelo `dia_semana`.
- Mutation usa `useSupabaseMutation` com invalidação de `["agenda_servicos"]`, `["presencas", date]` e `["v_servicos_agenda"]`.
- RBAC: professor só marca presença das suas próprias aulas (`profissional_id = auth.uid()`); coord/admin marcam qualquer uma.
- Histórico: cada marcação grava `marcado_por` e `marcado_em` para auditoria.

## Arquivos

**Criados**
- `supabase/migrations/...` — coluna `comparecimento`, tabela `agenda_presencas`, RLS, atualização da view.
- `src/pages/Presencas.tsx`
- `src/components/presencas/PresencaRow.tsx`
- `src/hooks/usePresencas.ts`

**Editados**
- `src/App.tsx` — rota `/presencas` (lazy).
- `src/components/AppSidebar.tsx` — item "Presenças".
- `src/pages/Agenda.tsx` — botões rápidos ✅/❌ no card.
- `src/pages/relatorios/Servicos.tsx` — exibir "X de Y marcadas" e excluir aulas futuras do denominador.

## Fora de escopo (pode vir depois)
- Notificação automática para o aluno quando faltar.
- Justificativa de falta com upload de atestado.
- Lembrete push ao professor no fim do dia para fechar a lista.