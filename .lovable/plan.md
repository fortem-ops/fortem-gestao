# Novo nível "Agregador" no Clube FORTEM

Hoje, alunos com plano **Gympass/Wellhub** ou **Total Pass** ficam com nível `start` + status `bloqueado`. Vamos criar um nível próprio chamado **Agregador** para identificá-los corretamente na carteirinha, listas e filtros, mantendo a regra de que não acumulam benefícios padrão.

## Mudanças no banco (migration)

1. Adicionar `'agregador'` ao enum `public.clube_nivel_membro` (após `max`).
2. Atualizar a função `public.fn_clube_nivel_por_plano` para retornar:
   - Plano `Gympass/Wellhub` ou `Total Pass` → `{ nivel: 'agregador', status: 'ativo' }` (deixa de ser `bloqueado`).
3. Rodar `public.fn_clube_resync_todos()` ao final da migration para reclassificar membros existentes (a função respeita membros `cancelado`).

## Mudanças no front-end

**`src/lib/clube.ts`**
- Acrescentar `agregador` em:
  - `NIVEL_LABEL` → `"AGREGADOR"`
  - `NIVEL_BADGE` → `"AGREGADOR MEMBER"`
  - `NIVEL_THEME` → paleta neutra distinta (ex.: bg `#1F2937`, text `#FFFFFF`, accent `#22C55E`, muted `#6B7280`) para diferenciar dos níveis pagos.
  - `NIVEL_RANK` → `agregador: -1` (fica abaixo de `start`, garantindo que filtros por nível mínimo nunca liberem benefícios para agregadores).

**`src/components/clube/AdminMembrosTable.tsx`**
- Incluir `"agregador"` em `NIVEL_OPTS` para aparecer no select de edição manual.

**`src/components/clube/StudentClubePanel.tsx`**
- Substituir o aviso atual (`status_membro === "bloqueado"`) por uma checagem em `nivel_membro === "agregador"`, mantendo o texto explicando que esses planos não recebem benefícios do Clube.

## Observações

- Benefícios continuam sem acesso para Agregador porque `NIVEL_RANK[agregador]` < `NIVEL_RANK[start]` em `PartnersList` e a função SQL `fn_clube_validar_token` usa o array `['start','start_plus','power','pro','max']` — `agregador` não está nele, então `array_position` retorna `NULL` e a comparação `< nivel_minimo` falha (recusado por "Nível insuficiente"). Comportamento desejado preservado.
- Carteirinha (`MembershipCard`) já lê `NIVEL_THEME[nivel_membro]` e `NIVEL_BADGE[nivel_membro]` automaticamente; a inclusão nos dicionários é suficiente.
- Tabela admin de benefícios usa `NIVEL_LABEL` com chaves de `Object.keys`, então o novo nível aparecerá automaticamente como opção de "nível mínimo" — ok, sem efeito prático já que ninguém usará Agregador como mínimo.
