## Problema

1. **"Última Aval. Funcional"** aparece "—" para todos os alunos.
2. **"Serviços do Plano"** e **"Serviços Contratados"** não aparecem no seu monitor.

## Causa

**(1)** `fetchLastFuncionalDateBatch` (`src/lib/avaliacaoFuncional.ts`) executa `.in("aluno_id", alunoIds)` com **todos os IDs de uma vez**. Após a importação de 692 inativos, o array tem ~1.700 UUIDs → a URL do PostgREST estoura o limite (~8 KB) e a query falha silenciosamente. Resultado: o mapa volta vazio e a coluna mostra "—" para todos.

**(2)** As colunas "Serviços do Plano" e "Serviços Contratados" usam a classe Tailwind `hidden xl:table-cell`. O breakpoint `xl` é **1280 px**, e seu viewport atual é **1203 px**, então o CSS responsivo as esconde. Não é um bug de dados — é um limite de largura.

## Correções

### 1. Chunkar a busca da última avaliação funcional

Em `src/lib/avaliacaoFuncional.ts`, dividir `alunoIds` em lotes de 300 antes dos `.in(...)`, agregando os resultados de `avaliacoes` e `agenda_servicos` no mesmo `latest` map (mesma lógica que já existe em `StudentList.tsx` para `planos`, `consumos`, `creditos`, `licencas`).

```text
chunk(ids, 300) → para cada chunk:
   supabase.from("avaliacoes")...in("aluno_id", chunk)...
   supabase.from("agenda_servicos")...in("aluno_id", chunk)...
   fundir em latest[]
```

Sem alterar a assinatura da função nem o consumo no `StudentList`.

### 2. Mostrar Serviços do Plano / Contratados em telas menores

Em `src/pages/StudentList.tsx`, trocar `hidden xl:table-cell` por `hidden lg:table-cell` nas duas colunas (cabeçalho, células de skeleton e células de dados) — assim aparecem a partir de 1024 px, cobrindo monitores como o seu (1203 px). Nenhuma mudança na lógica de dados.

## Arquivos a editar

- `src/lib/avaliacaoFuncional.ts` — adicionar chunking em `fetchLastFuncionalDateBatch`.
- `src/pages/StudentList.tsx` — trocar `xl:table-cell` → `lg:table-cell` nas 6 ocorrências (header + skeleton + linha) das duas colunas de serviços.

Sem mudanças em schema, RLS, ou outros componentes.
