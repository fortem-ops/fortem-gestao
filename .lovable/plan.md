## Reverter o sumiço dos Alunos Ativos

### Causa raiz

Os alunos ativos não sumiram do banco — os 199 continuam lá. O que aconteceu:

- A tela `/alunos` carrega **todos** os registros com `supabase.from('alunos').select(...).order('nome')`.
- O PostgREST aplica um **limite padrão de 1.000 linhas** por requisição.
- Total atual: 822 leads + 692 inativos + 199 ativos + 3 prospects = **1.716**.
- Ordenado por nome, apenas os primeiros 1.000 voltam — só **120 dos 199 ativos** entram nessa janela. Os outros 79 ficam fora.

A importação de 692 inativos empurrou ativos com nome mais "tarde" no alfabeto para fora do limite.

### Correção

Trocar a busca única por **busca paginada** em `src/pages/StudentList.tsx`:

- Loop em páginas de 1.000 (`.range(from, to)`) até `data.length < 1000`.
- Assim todos os 1.716 (e crescentes) são carregados; ativos voltam a aparecer integralmente.

Mesmo padrão aplicado a queries dependentes que usam `.in('aluno_id', ids)` — Supabase também tem limite no IN; vamos quebrar em chunks de 500 quando `ids.length > 500` para `planos`, `consumo_servicos`, `creditos_aluno`, `aluno_licencas`.

### Por que não apagar os importados

Apagar os 692 inativos esconderia o sintoma mas voltaria a quebrar assim que a base passar de 1.000 alunos por crescimento natural. A correção via paginação é definitiva e não perde dados.

### Arquivo afetado

- `src/pages/StudentList.tsx` — apenas a função `queryFn` do `useQuery(["alunos_with_plans"])`.

Nenhuma alteração de schema, RLS, ou de outras telas.
