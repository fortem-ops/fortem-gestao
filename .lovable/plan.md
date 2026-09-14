# Mostrar brinde escolhido nas Encomendas

## Contexto
- A aba Encomendas (`src/components/loja/EncomendasTab.tsx`) lista encomendas pagas com cliente, modelo, cor, tamanho, data, quantidade e valores, mas não exibe o brinde da campanha.
- A coluna `pedidos.brinde_escolhido` já existe e a aba Pedidos já a consulta e exibe como badge (`PedidosTab.tsx`, linhas 45/187/259/292).

## Mudança (somente frontend, `EncomendasTab.tsx`)
1. Consulta: incluir `brinde_escolhido` no select de `pedidos` e no tipo `PedidoRow`.
2. Linha: repassar `brindeEscolhido: p.brinde_escolhido ?? null` no tipo `Linha`.
3. Exibição: no menu da coluna Cliente (junto do badge do cupom), renderizar um badge "Brinde: {nome}" quando houver — mesmo padrão visual do badge de cupom (`variant="outline"`, texto pequeno), com ícone de presente (lucide `Gift`).
4. Busca: incluir o nome do brinde no alvo da busca por texto, para localizar encomendas pelo brinde.

## Não alterar
- Filtros, rateio de valores, exclusão, agrupamento por modelo e demais telas da Loja permanecem como estão.

## Verificação
- `bunx tsgo --noEmit`.
