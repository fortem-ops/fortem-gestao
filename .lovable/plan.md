## Problema

Na planilha do usuário, a coluna **"Plano data de início"** contém células do tipo *date* do Excel com formato visual `mm-dd-yy`. O parser atual usa:

```ts
XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
```

Com `raw: false`, o SheetJS formata cada célula de data usando **o formato da própria célula** (`mm-dd-yy`), produzindo strings como `"11/18/25"`. O `dateNF` só é aplicado a células sem formato. Em seguida, `normalizeDate` interpreta `"11/18/25"` como DD/MM/AA → mês 18 inválido → retorna a string original, que falha no schema (ou grava data inválida).

A coluna "Data de Nascimento", por ser texto puro (`19/05/1985`), continua funcionando.

## Correção

Em `src/lib/studentImport.ts`, na função `parseXLSX`:

1. Trocar `raw: false` por `raw: true` mantendo `cellDates: true`. Assim, células de data vêm como objetos `Date` do JavaScript, que `normalizeDate` já trata corretamente no ramo `v instanceof Date` (retornando `AAAA-MM-DD`). Remover `dateNF` (deixa de ser necessário).
2. Como `raw:true` devolve números/booleans crus para outras colunas, garantir que `cleanCell` e os normalizadores continuem aceitando qualquer tipo via `String(v)` (já é o caso atual).

Nenhuma outra mudança é necessária — `normalizeDate` já cobre `Date`, `AAAA-MM-DD`, `DD/MM/AAAA`, `DD-MM-AAAA` e seriais Excel.

## Arquivo alterado
- `src/lib/studentImport.ts` (uma linha em `parseXLSX`)
