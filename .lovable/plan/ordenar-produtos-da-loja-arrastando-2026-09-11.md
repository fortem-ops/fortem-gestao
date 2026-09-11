# Ordenar produtos da Loja arrastando

Hoje a vitrine (`/store` e a loja do Portal) mostra os produtos pela data de criação, do mais novo para o mais antigo, e a administração lista em ordem alfabética. Não existe posição definida manualmente.

## O que muda

- Na aba **Produtos** da administração da Loja, cada linha ganha uma alça de arrastar. Ao soltar, a nova posição é salva na hora.
- A vitrine (loja pública e loja dentro do Portal do Aluno) passa a mostrar os produtos exatamente nessa ordem.
- A alça de arrastar só fica ativa quando não há busca nem filtro de categoria aplicados (para não reordenar uma lista parcial). Com filtro ativo, a lista aparece na ordem salva, mas sem arrastar.
- Produtos existentes recebem uma posição inicial seguindo a ordem atual (mais recentes primeiro), então nada some nem muda de lugar sozinho.

## Detalhes técnicos

- **Banco**: migration adicionando `ordem integer NOT NULL DEFAULT 0` em `public.produtos_catalogo`, backfill numerando os registros existentes por `created_at DESC` em passos de 10, e índice em `(ordem)`. Nenhuma coluna removida; RLS e grants atuais permanecem.
- **Admin** `src/components/loja/ProdutosTab.tsx`: incluir `ordem` no tipo `Produto` e na consulta (`.order("ordem").order("nome")`); coluna extra com `GripVertical` e handlers HTML5 (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) no mesmo padrão já usado em `StudentExerciseBank.tsx`; mutation `reorder` que atualiza `ordem = (i+1)*10` em lote e invalida `["loja-produtos"]` e `["loja","produtos"]`. Novos produtos entram com `ordem = maior atual + 10`.
- **Vitrine** `src/hooks/useProdutosLoja.ts`: incluir `ordem` em `PRODUTO_COLS` e trocar `.order("created_at", { ascending: false })` por `.order("ordem", { ascending: true }).order("created_at", { ascending: false })`; adicionar `ordem` em `ProdutoCatalogo` (`src/integrations/store/types.ts`).
- Filtro por categoria e busca em `StoreIndex.tsx` continuam iguais — apenas preservam a ordem recebida.
