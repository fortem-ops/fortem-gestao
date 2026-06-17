## Diagnóstico

A licença de 8 dias da Larissa foi salva corretamente em `aluno_licencas`, mas o plano dela está com `data_fim = NULL` (apenas `data_inicio = 2026-03-02` e `duracao_meses = 12`). O trigger atual `trg_aluno_licencas_extende_plano` tem a cláusula `WHERE id = v_plano_id AND data_fim IS NOT NULL`, então pula qualquer plano cuja data final ainda não esteja materializada — que é o caso da maioria dos planos hoje (Start+, Pro, Power, etc. quase todos têm `data_fim NULL`).

Na UI, a data final exibida vem de `data_fim ?? calcEndDate(data_inicio, duracao_meses)`, ou seja, é calculada na hora. Como o trigger não escreve nada, a extensão "some" visualmente.

## Correção

### 1. Atualizar o trigger `aluno_licencas_extende_plano`

Quando for adicionar dias (INSERT, ou UPDATE que aumenta `dias`, ou troca de `plano_id`):

- Se `planos.data_fim IS NOT NULL` → soma `v_delta` em `data_fim` (comportamento atual).
- Se `planos.data_fim IS NULL` mas `data_inicio` e `duracao_meses` existem → **materializa** `data_fim = data_inicio + duracao_meses meses + v_delta` em uma única atualização. A partir daí o plano passa a ter `data_fim` explícita e os próximos ajustes seguem o caminho normal.
- Se nem `data_inicio`/`duracao_meses` existem → ignora (caso de borda, mantém comportamento silencioso).

Quando for remover dias (DELETE, ou UPDATE que reduz `dias`, ou troca de plano):

- Só ajusta se `planos.data_fim IS NOT NULL`. Não vamos "materializar para reduzir" — se o plano nunca teve `data_fim` setada, não há o que reduzir (a licença anterior também não havia estendido).

`proxima_renovacao`: mantém a regra atual (só ajusta quando `renovacao_automatica = true` e `proxima_renovacao IS NOT NULL`). Não há mudança aqui — planos mensais com renovação automática já entram nesse caminho.

### 2. Backfill da Larissa

Aplicar manualmente o efeito da licença existente no plano dela:

- `planos.data_fim = (2026-03-02 + 12 meses) + 8 dias = 2027-03-10` no plano `a9f596d8-592e-4d91-a2d5-bc9532e625eb`.

Não vou fazer backfill global das licenças antigas (mantém a decisão de "não retroativo" definida no plano original); só corrijo a Larissa porque o caso foi reportado.

### 3. Sem mudanças no frontend

A lógica de exibição `data_fim ?? calcEndDate(...)` continua válida — assim que o trigger materializar `data_fim`, a UI passa a mostrar o valor estendido automaticamente. As invalidações de query já estão no lugar.

## Fora de escopo

- Recalcular `proxima_renovacao` para planos sem renovação automática.
- Mudar a regra de cálculo de `dias` da licença.
- Backfill de outros alunos com licenças antigas.