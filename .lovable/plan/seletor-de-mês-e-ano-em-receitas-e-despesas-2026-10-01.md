# Seletor de Mês e Ano em Receitas e Despesas

## Problema
O navegador de mês em Financeiro > Receitas (e Despesas) usa `<input type="month">`, que depende do suporte do navegador: em vários casos aparece como um campo de texto sem seletor e não dá para escolher mês e ano de forma clara.

## Solução
Substituir o campo `type="month"` por dois seletores explícitos, um ao lado do outro:

- **Mês** — Select com janeiro a dezembro (nomes em pt-BR, capitalizados).
- **Ano** — Select com a lista de anos de 2017 até o ano atual (gerada dinamicamente).

As setas ◀/▶ permanecem como estão. Escolher mês ou ano atualiza `mesRef` imediatamente (mesmo comportamento de hoje).

## Arquivos alterados
1. `src/pages/financeiro/Receitas.tsx` — trocar o `Input type="month"` (linhas ~148–154) por `Select` de mês + `Select` de ano.
2. `src/pages/financeiro/Despesas.tsx` — mesma troca (linhas ~131–137), para manter as duas telas idênticas.

## Fora do escopo
- Nenhuma mudança de dados, hooks, filtros, gráficos ou permissões.
- Demais telas do Financeiro não são tocadas.
