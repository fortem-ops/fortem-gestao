## Problema

Ao excluir um agendamento que consumiu um crédito avulso (origem `servico` em `creditos_aluno`), o trigger `fn_agenda_estornar_credito` registra o movimento de `estorno` em `creditos_movimentos`, mas **não** decrementa `creditos_aluno.quantidade_usada`. Resultado: o saldo do aluno fica travado e ele não consegue reagendar o serviço.

Caso confirmado: aluno **VÍTOR LABRES DA SILVEIRA** — crédito de Avaliação Funcional permanece com `quantidade_usada=1` mesmo após o cancelamento ter sido feito hoje às 16:56.

## Causa raiz

Na função `fn_agenda_estornar_credito` (trigger AFTER DELETE em `agenda_servicos`), há este teste:

```sql
IF _credito IS NOT NULL AND NOT _credito.ilimitado THEN
   UPDATE public.creditos_aluno SET quantidade_usada = ...
```

Em PL/pgSQL, `<record> IS NOT NULL` só é verdadeiro quando **todos** os campos do record são não-nulos. Como `creditos_aluno.data_validade` é NULL para este aluno (e para a maioria dos créditos), a expressão retorna FALSE e o UPDATE é pulado. O INSERT do movimento de estorno (que está fora do IF) acontece normalmente, o que mascarou o problema.

## O que será feito

1. **Migration corrigindo a função** `fn_agenda_estornar_credito`:
   - Trocar `_credito IS NOT NULL` por `_credito.id IS NOT NULL` (teste correto sobre PK).
   - Manter o resto da lógica idêntica (estorno via `GREATEST(0, quantidade_usada - quantidade)`, registro do movimento).

2. **Backfill (data fix)** via insert tool, em uma única transação:
   - Para cada `creditos_aluno` afetado, recalcular `quantidade_usada` como `SUM(consumo) - SUM(estorno)` a partir de `creditos_movimentos`, com piso 0.
   - Isso corrige o saldo do Vítor Labres e qualquer outro aluno que tenha tido cancelamento sem estorno efetivo desde que o trigger entrou em produção.

3. **Sem alterações no frontend.** O fluxo de cancelamento já dispara DELETE em `agenda_servicos`, que aciona o trigger corrigido. Após a migration:
   - Estorno de crédito de plano: já funciona (trigger BEFORE DELETE remove a linha em `consumo_servicos`).
   - Estorno de crédito avulso: passará a decrementar `quantidade_usada` corretamente.

## Verificação

Após aplicar:
- Consultar `creditos_aluno` do Vítor Labres → `quantidade_usada` deve ser 0.
- Conferir que reagendar a Avaliação Funcional funciona normalmente pelo modal de Novo Horário.
