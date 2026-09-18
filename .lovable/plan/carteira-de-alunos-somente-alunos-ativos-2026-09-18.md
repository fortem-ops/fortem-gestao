# Carteira de Alunos — somente alunos ATIVOS

## Diagnóstico (confirmado)

A Carteira (`src/pages/CarteiraAlunos.tsx`) filtra apenas por `planos.ativo = true` + `alunos.status = 'ativo'`. Porém o flag `ativo` do plano não significa plano vigente: o plano da Alice Brinckmann Oliveira Netto tem `ativo=true`, mas `data_fim = 2026-07-17` (vencido) e `renovacao_automatica = false`.

A regra canônica de "aluno ativo" já existe e é usada em Cadastros > Alunos Ativos (`src/lib/studentStatus.ts` → `getDisplayStatus()` + `ACTIVE_STATUS_KEYS`): o aluno só é Ativo com plano vigente (`data_fim >= hoje` ou auto-renovável), ou em licença vigente, ou "Ativo · Corrida". A Carteira não aplica essa regra — por isso alunos inativos aparecem.

## Mudanças

### `src/pages/CarteiraAlunos.tsx` (query "carteira-alunos")

- Buscar planos ativos com os campos completos (`id, aluno_id, tipo, atividade, data_inicio, data_fim, duracao_meses, ativo, created_at`) — sem mudar a estrutura de paginação/chunking existente (a query atual é simples; manter em uma consulta).
- Buscar também as licenças dos alunos (`aluno_licencas`), como faz o StudentList.
- Para cada aluno, aplicar `selecionarPlanoExibicao()` + `getDisplayStatus(status, planoDataFim(plano), licencas, plano.tipo, { corridaOnly })` e manter **somente** quem estiver em `ACTIVE_STATUS_KEYS` (`ativo`, `ativo_corrida`, `licenca`).
- Remover o filtro solto `.eq("status", "ativo")` (o `getDisplayStatus` já cobre lead/prospect/avulso/encerrado); manter `.eq("is_equipe", false)`.
- Manter a otimização de filtrar alunos por IDs de planos ativos antes (evita varrer todos os alunos), agora validando vigência depois.

Nada mais muda: colunas, indicadores (Avaliação Funcional / Ficha / Relatório), transferência, filtros e ordenação permanecem.

### O que NÃO muda

- Nenhuma migration, nenhum dado: planos vencidos continuam com `ativo=true` (comportamento consistente com as demais telas, que avaliam vigência pela data).
- Nenhuma outra tela é tocada.

## Validação

- Typecheck + build.
- Playwright autenticado em `/carteira`: confirmar que Alice (e outros inativos) somem e que alunos com plano vigente permanecem.
