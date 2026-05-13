## Cadastro de Feriados e Férias em Admin → Ponto

Adicionar dois novos cadastros em `Admin → Ponto` para que dias sem expediente (feriados coletivos) e ausências justificadas individuais (férias / folgas) deixem de contar como "pendência" ou "não iniciou" nas telas de Ponto.

### 1. Banco de dados (migração)

Criar duas tabelas:

**`ponto_feriados`** (vale para todos os funcionários)
- `data` (date, único)
- `descricao` (text)
- `tipo` (enum: `nacional`, `estadual`, `municipal`, `facultativo`, `recesso`)

**`ponto_ferias`** (vínculo individual)
- `usuario_id` (uuid)
- `data_inicio`, `data_fim` (date)
- `tipo` (enum: `ferias`, `folga`, `atestado`, `licenca`)
- `observacao` (text, opcional)

RLS: leitura para autenticados; escrita restrita a `is_admin`/`is_coordinator_or_admin`.

Função utilitária `fn_ponto_dia_ausencia(_user_id uuid, _data date) → text` retornando `null`, `'feriado'`, `'ferias'`, `'folga'`, etc. — usada por todas as views/funções abaixo.

### 2. Atualizar funções de cálculo

**`fn_ponto_dashboard_coordenador`** (Equipe Ponto)
- Considerar a data consultada: se cair em feriado, ou se o colaborador está em férias/folga, devolver `status = 'ausente_justificado'` com um campo extra `motivo_ausencia` (`feriado`/`ferias`/etc.) em vez de `'nao_iniciou'`.
- O contador `nao_iniciaram` no resumo deixa de incluir esses casos; adicionar contador `ausencias_justificadas`.

**`fn_ponto_calcular_fechamento`** (Fechamento Ponto)
- Recalcular `_dias_uteis` considerando os horários ativos do colaborador (segunda–sábado de `ponto_horarios_professor`, respeitando `frequencia_mensal` aos sábados) **menos** os dias caídos em feriado ou no intervalo de férias do próprio colaborador.
- Hoje a função usa `_dias_uteis = COUNT jornadas com entrada`, o que mascara faltas; passa a usar a janela real do mês menos ausências justificadas, multiplicada por `carga_diaria_min`.
- Adicionar campos no retorno e na tabela `ponto_fechamentos_mensais`: `dias_feriado`, `dias_ferias` (ambos `int default 0`).

### 3. UI — Admin Ponto (`src/pages/AdminPonto.tsx`)

Trocar o conteúdo atual por `Tabs`:
- **Horários por funcionário** (componente atual `AdminPontoHorarios`).
- **Feriados** (novo `AdminPontoFeriados`): tabela com data + descrição + tipo, formulário inline para adicionar, botão remover. Botão opcional "Importar feriados nacionais do ano X" (cliente, lista hard-coded BR).
- **Férias / Folgas** (novo `AdminPontoFerias`): seleção do funcionário (mesma query `ponto-colaboradores-list`), tabela das ausências cadastradas, formulário (período + tipo + observação), botão remover.

### 4. UI — telas de visualização

**Equipe Ponto (`EquipeAoVivoTable.tsx`)**
- Adicionar badge "Feriado" (cinza-azulado) e "Férias/Folga" (roxo) usando o novo `status = 'ausente_justificado'` + `motivo_ausencia`.
- Card-resumo extra "Ausências justificadas".
- Linha não conta como pendência; coluna Horas exibe "—".

**Relatório Ponto (`RelatorioPonto.tsx`)**
- Buscar feriados e férias da janela consultada.
- Em `previstoMinutos`, zerar previsto de dias em feriado/férias do colaborador.
- Exibir uma linha sintética por dia ausente com badge "Feriado: <descrição>" ou "Férias", em vez de "Sem registro".
- Pendências (`pendenciasJornada`) ignora dias com ausência justificada.

**Fechamento Ponto (`FechamentoMensalTable.tsx`)**
- Mostrar duas colunas extras: "Feriados" e "Férias" (dias).
- Botão "Recalcular" continua chamando `fn_ponto_calcular_fechamento` (já considerará as ausências).

**Ponto pessoal (`src/pages/Ponto.tsx` / `ResumoDoDia.tsx`)**
- Se hoje é feriado ou o usuário está de férias, exibir aviso "Hoje é feriado — não é necessário bater ponto" e desabilitar o botão inteligente. (Sem bloquear no banco — apenas UX; manter possibilidade de bater ponto se o usuário insistir, marcando a jornada com observação automática.)

### 5. Arquivos afetados

- Nova migração `supabase/migrations/...` — tabelas, enums, RLS, função `fn_ponto_dia_ausencia`, `CREATE OR REPLACE` de `fn_ponto_dashboard_coordenador` e `fn_ponto_calcular_fechamento`, colunas extras em `ponto_fechamentos_mensais`.
- Novo `src/components/ponto/AdminPontoFeriados.tsx`.
- Novo `src/components/ponto/AdminPontoFerias.tsx`.
- Editado `src/pages/AdminPonto.tsx` — Tabs.
- Editado `src/components/ponto/EquipeAoVivoTable.tsx` — novo status + badge + card.
- Editado `src/pages/RelatorioPonto.tsx` — lógica de previsto e linhas de ausência.
- Editado `src/components/ponto/FechamentoMensalTable.tsx` — colunas extras.
- Editado `src/pages/Ponto.tsx` ou `src/components/ponto/ResumoDoDia.tsx` — aviso de feriado/férias.
- `src/lib/ponto.ts` — helpers `isFeriado(date, feriados)` e `getAusencia(userId, date, ferias)`.

Sem mudanças em rotas, sidebar ou permissões existentes.