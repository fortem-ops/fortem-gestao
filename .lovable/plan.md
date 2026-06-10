## Objetivo

Em **Comissionamentos > Meta da carteira**, a contagem de alunos qualificados deve incluir somente alunos ativos com plano **Start, Start+, Power ou Pro**. Planos **VIP**, **Gympass/Wellhub** e **Total Pass** (agregadores) ficam de fora — tanto no total global quanto na contagem por profissional e na aba **Carteira**.

A função no banco (`fn_carteira_ativos_por_profissional`) já aplica essa regra corretamente (exclui Gympass/Wellhub, Total Pass e VIP). O problema está no frontend, que usa filtros próprios e mais permissivos (não exclui VIP), divergindo do backend.

## Alterações

### 1. `src/hooks/useComissionamentos.ts` — `useCarteiraStats`
Trocar o filtro atual:
```ts
const planoOk = ps.some((p) => !["Gympass/Wellhub", "Total Pass"].includes(p.tipo));
```
por uma whitelist alinhada ao backend:
```ts
const PLANOS_QUALIFICADOS = ["Start", "Start+", "Power", "Pro"];
const planoOk = ps.some((p) => PLANOS_QUALIFICADOS.includes(p.tipo));
```
Isso passa a excluir corretamente VIP, Gympass/Wellhub e Total Pass do `total` e `meus`.

### 2. `src/pages/Comissionamentos.tsx` — `CarteiraDetalhe`
Mesma whitelist na aba **Carteira > Alunos qualificados**. Ajustar também o texto do motivo para refletir as três causas possíveis:
- "Em licença"
- "Plano VIP/Agregador (não qualifica)"
- "Sem plano ativo qualificado"

### 3. Texto do card "Meta da carteira"
Pequeno ajuste no subtítulo para deixar explícito o critério: "alunos ativos qualificados (Start/Start+/Power/Pro)".

## Fora de escopo

- Função `fn_carteira_ativos_por_profissional` no banco — já está correta, não precisa migração.
- Widget `CarteiraWidget` do Dashboard — conta apenas "alunos com plano ativo" (não é a meta de comissionamento); não tocar a menos que você queira o mesmo critério lá.
