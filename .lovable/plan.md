## Objetivo

Tornar o plano **VIP** selecionável em todos os fluxos de cadastro/edição de aluno e demais lugares onde se escolhe "Plano". A variante (1x/2x/3x/Livre) é derivada da **frequência semanal** já existente no formulário — não criamos 4 itens separados no select, mantendo a UI enxuta.

## Comportamento

- No select de **Plano** do formulário de aluno (usado em "Novo Aluno" e "Editar Aluno"), adicionar a opção **VIP** (estilo dourado/Crown opcional).
- Ao salvar com plano = VIP, o `tipo` gravado na tabela `planos` será composto a partir da `frequencia_semanal`:
  - 1 → `VIP 1x/semana`
  - 2 → `VIP 2x/semana`
  - 3 → `VIP 3x/semana`
  - 0 (Livre) → `VIP Livre`
- Vigência: 1 mês. Serviços inclusos: nenhum. Valor padrão sugerido: 0,00 (editável).
- A renovação automática já é tratada pelo trigger `fn_planos_autorenew_defaults` (qualquer `tipo` começando com `vip`).
- Dashboard (card VIP) e comissionamento já tratam `tipo ILIKE 'vip%'` — sem mudanças no backend.

## Arquivos a alterar (somente front-end)

1. **`src/components/student/StudentFormFields.tsx`**
   - Adicionar `VIP: { label: "VIP", duracao: 1, servicos: [] }` em `PLAN_CONFIG`.
   - Incluir `"VIP"` no `z.enum` do schema.
   - Adicionar `<SelectItem value="VIP">VIP</SelectItem>` no select de Plano.
   - `getPlanDetails("VIP", ...)` retornará `{ tipo: "VIP", duracao_meses: 1, servicos: [] }`.

2. **`src/components/student/AddStudentDialog.tsx`** e **`src/components/student/EditStudentDialog.tsx`**
   - Antes do `insert/update` em `planos`, se `plan.tipo === "VIP"`, substituir por:
     ```ts
     const freq = values.frequencia_semanal;
     const sufixo = freq === 0 ? "Livre" : `${freq}x/semana`;
     tipoFinal = `VIP ${sufixo}`;
     ```
   - Em `EditStudentDialog`, o mapeamento reverso (carregar plano atual) deve reconhecer `tipo` começando com `VIP` e popular `plano = "VIP"`.

3. **`src/lib/studentImport.ts`**
   - Adicionar `"VIP"` em `PLAN_TYPES`.
   - Normalizador: `if (s === "VIP" || s.startsWith("VIP ")) return s` (preservar variante já vinda).

4. **`src/components/dashboard/PlansDistributionWidget.tsx`**
   - Incluir `"VIP"` em `PLAN_ORDER` e cor dourada `#D4AF37` em `PLAN_COLORS`.
   - Ajustar agrupamento: qualquer `tipo` começando com `VIP` é contabilizado como "VIP" (consolida 1x/2x/3x/Livre na fatia).

5. **`src/components/student/StudentSummary.tsx`** e **`src/components/dashboard/AdminAlertsWidget.tsx`**
   - Incluir `"VIP"` em `RECURRING_PLANS` (ou trocar para checagem via `isAutoRenewPlan`) — VIP é mensal recorrente e não deve disparar alertas de "plano expirando".

## Fora de escopo

- Sem mudanças no banco: o trigger e as funções de dashboard/carteira já cobrem `vip%`.
- Sem novo seletor de variante VIP separado — mantém a UX consistente com a frequência semanal já escolhida.
- Sem alterações em `planos_catalogo` (Admin → Planos continua editável manualmente).
