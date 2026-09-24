# Alertas Técnicos — somente alunos ativos

## Diagnóstico (confirmado)

O widget `src/components/dashboard/AlertsWidget.tsx` filtra alunos apenas por `alunos.status = 'ativo'` (linha 59, troca de ficha; linha 85, reavaliação funcional). Esse flag não significa plano vigente — alunos com plano vencido continuam com `status='ativo'` no cadastro e por isso seguem gerando alertas de "Troca de ficha atrasada" e "Reavaliação".

A regra canônica de "aluno ativo" já existe em `src/lib/studentStatus.ts` (`getDisplayStatus()` + `ACTIVE_STATUS_KEYS`): ativo só com plano vigente (`data_fim >= hoje` ou auto-renovável), em licença vigente, ou "Ativo · Corrida". É a mesma correção já aplicada na Carteira de Alunos.

## Mudanças

### `src/components/dashboard/AlertsWidget.tsx`

- Na query, buscar também os planos ativos dos alunos (`planos`: `id, aluno_id, tipo, ativo, data_inicio, data_fim, duracao_meses`) e as licenças (`aluno_licencas`), no mesmo padrão da Carteira.
- Para cada aluno, calcular `selecionarPlanoExibicao()` + `getDisplayStatus(status, planoDataFim(plano), licencas, plano.tipo, { corridaOnly })` e considerar "ativo" somente quem estiver em `ACTIVE_STATUS_KEYS` (`ativo`, `ativo_corrida`, `licenca`).
- Trocar os dois filtros `aluno.status !== "ativo"` / `a.status === "ativo"` por essa verificação.
- O bloco de "Atualização de treino" (tarefas automáticas) não filtra por status hoje — passa a exigir aluno ativo pela mesma regra, para não alertar sobre aluno encerrado.

### O que NÃO muda

- Nenhuma migration, nenhum dado: planos vencidos continuam como estão; a vigência é avaliada pela data, como nas demais telas.
- Regras de prazo (semanas por frequência, 4/6 meses de reavaliação, 7 dias de tarefa) e a ordenação por severidade permanecem.
- Nenhuma outra tela é tocada.

## Validação

- Typecheck + build.
- Playwright autenticado no Início: confirmar que o quadro passa a listar só alunos com plano vigente/licença/corrida e que alertas de alunos encerrados somem.
