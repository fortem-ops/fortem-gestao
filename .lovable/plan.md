## Objetivo

Hoje, na **Agenda**, a checagem e o débito de créditos só consideram créditos vindos de um **Plano** (lendo `planos.servicos` + `consumo_servicos`). Isso ignora os créditos avulsos vendidos pela aba **Serviços** do dialog "Nova Venda", que ficam em `creditos_aluno` (`origem_tipo='servico'`).

A meta é: ao agendar uma atividade para um aluno, considerar **a soma de créditos disponíveis** vindos tanto de planos quanto de serviços, e debitar de forma única.

## Modelo a usar

A tabela canônica é `creditos_aluno` (já populada pelo trigger `fn_processar_venda`):

- `aluno_id`, `atividade`, `quantidade_inicial`, `quantidade_usada`, `ilimitado`, `data_validade`, `ativo`, `origem_tipo` ('plano' | 'servico').
- O saldo de uma linha = `quantidade_inicial - quantidade_usada` (ou ilimitado).
- O saldo total do aluno para uma atividade = soma das linhas ativas e não vencidas.

Os movimentos individuais (compra / consumo / estorno) ficam em `creditos_movimentos`.

## Mudanças

### 1. Banco — trigger de débito automático na Agenda

Criar duas funções + triggers em `agenda_servicos`:

- **AFTER INSERT** (`fn_agenda_debitar_credito`): se `aluno_id` não nulo e `atividade` corresponde a alguma atividade em `creditos_aluno` do aluno:
  - Seleciona a primeira linha de crédito ativa (FIFO por `data_validade NULLS LAST, created_at`) com saldo > 0 ou `ilimitado=true`.
  - Se nenhuma encontrada → `RAISE EXCEPTION 'Aluno sem créditos disponíveis para %', atividade`.
  - Se ilimitada: insere apenas `creditos_movimentos` (tipo `consumo`, agenda_id, quantidade 1).
  - Senão: incrementa `quantidade_usada` em 1 e insere `creditos_movimentos` (tipo `consumo`).
- **AFTER DELETE** (`fn_agenda_estornar_credito`): para cada `creditos_movimentos` com `agenda_id = OLD.id` e `tipo='consumo'`, insere movimento `estorno` e decrementa `quantidade_usada` da linha original.

Mapeamento de atividade: usa string exata (`Nutrição`, `Reabilitação`, `Avaliação Funcional`, `Avaliação Física`, etc.). Atividades sem crédito cadastrado (`Treino Experimental`, `Recovery`) seguem sem débito (trigger só age quando há linha em `creditos_aluno` com a mesma atividade — caso contrário não bloqueia).

### 2. Frontend — `src/components/agenda/AddAgendaDialog.tsx`

- Substituir a query `student_credits` por uma que lê `creditos_aluno` agregado por atividade do aluno selecionado:
  - filtra `aluno_id`, `atividade = atividade selecionada`, `ativo=true`, `data_validade IS NULL OR >= today`.
  - Calcula `total = sum(quantidade_inicial)`, `usado = sum(quantidade_usada)`, `restante = total-usado`, `ilimitado = bool_or(ilimitado)`, e marca origens distintas (plano/serviço).
- Remover a inserção manual em `consumo_servicos` no `mutationFn` — o trigger de banco fará o débito.
- Atualizar o card "Créditos" para:
  - exibir `restante` e `total` agregados.
  - mostrar badges de origem ("Plano" / "Serviço") quando ambos existirem.
  - se `ilimitado`, exibir ∞ e nunca bloquear o botão.
- Botão "Salvar" segue desabilitado quando `aluno_id` selecionado, atividade tem créditos cadastrados e `restante <= 0` (e não é ilimitado).
- Invalidate `["creditos-aluno", alunoId]` no onSuccess além das chaves atuais.

### 3. Compatibilidade

- O fluxo legado (`consumo_servicos` + `planos.servicos`) deixa de ser lido pela Agenda. Nada é apagado — mantido para histórico em outras telas.
- Nenhuma mudança no `VendaDialog` é necessária: as vendas de plano e serviço já populam `creditos_aluno` via `fn_processar_venda`.

## Fora de escopo

- Reescrever a UI de créditos no portal do aluno (já lê `consumo_servicos`).
- Migração retroativa de `consumo_servicos` antigos para `creditos_movimentos`.
- Edição de evento que troque `aluno_id`/`atividade` (estorno + novo débito) — pode ser tratado depois; por ora, o trigger só age em INSERT/DELETE puros.