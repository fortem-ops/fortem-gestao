## Objetivo
Adicionar a página **Financeiro > Adquirente** para cadastrar manualmente as taxas MDR (Rede) por bandeira e modalidade, mais o **aluguel de máquina** (custo fixo mensal). Esses valores serão a base para calcular recebíveis reais nas próximas etapas.

## Escopo desta entrega
Apenas cadastro + edição. A aplicação das taxas/aluguel em relatórios e recebíveis líquidos fica para o próximo passo.

## Estrutura das taxas
Matriz Bandeira × Modalidade:

```text
Bandeiras:   VISA · MASTERCARD · ELO
Modalidades: Débito
             Crédito à vista (recorrência REDE)
             Crédito parcelado 2–6x
             Crédito parcelado 7–12x
```
Total: 3 × 4 = **12 taxas** por adquirente.

Mais 1 campo separado: **Aluguel de máquina (R$/mês)** por adquirente.

## Backend (Lovable Cloud)

**Tabela `adquirentes_taxas`** (matriz MDR):
- `adquirente` (text, default `'rede'`)
- `bandeira` (enum: `visa | mastercard | elo`)
- `modalidade` (enum: `debito | credito_vista | credito_2_6x | credito_7_12x`)
- `taxa_percentual` (numeric(5,2)) — ex.: `3.19` = 3,19%
- `prazo_recebimento_dias` (int, opcional)
- `ativo` (bool, default true)
- `updated_by` (uuid), `created_at`, `updated_at`
- UNIQUE (`adquirente`, `bandeira`, `modalidade`)
- CHECK `taxa_percentual BETWEEN 0 AND 100`

**Tabela `adquirentes_config`** (configs de adquirente, 1 linha por adquirente):
- `adquirente` (text PK, default `'rede'`)
- `aluguel_mensal` (numeric(10,2), default 0) — valor em R$
- `ativo` (bool, default true)
- `updated_by`, `created_at`, `updated_at`
- CHECK `aluguel_mensal >= 0`

RLS: leitura/escrita restritas a Admin e Coordenador (via `has_role`). GRANT para `authenticated` e `service_role`. Trigger `updated_at`. Seed: 12 linhas Rede em `adquirentes_taxas` com `0.00` e 1 linha Rede em `adquirentes_config` com aluguel `0.00`.

## Frontend
1. **Rota** `/financeiro/adquirente` em `src/App.tsx` (lazy).
2. **Sidebar** (`src/components/AppSidebar.tsx`): item "Adquirente" no grupo Financeiro (ícone `Percent`), abaixo de "Cartões de Crédito".
3. **Página** `src/pages/financeiro/Adquirente.tsx`:
   - Header com seletor de adquirente (apenas "Rede" por enquanto).
   - **Card 1 — Taxas MDR (%)**: tabela editável 3 linhas (bandeiras) × 4 colunas (modalidades), inputs numéricos com sufixo `%`, 2 casas decimais.
   - **Card 2 — Aluguel de máquina (R$/mês)**: input único com máscara de moeda BRL.
   - Botões **Salvar alterações** / **Descartar**; destaque visual quando `dirty`.
   - Toasts de sucesso/erro; persistência em lote via Supabase (`upsert`).
4. **Hook** `src/hooks/useAdquirente.ts` com `useQuery` (taxas + config) e mutations de upsert.
5. **Tipos** `src/types/adquirente.ts` (enums + labels PT-BR).
6. **Permissão**: Admin/Coordenador editam; demais visualizam em modo leitura.

## Validações
- Taxa: `0`–`100`, até 2 casas decimais (Zod + CHECK no banco).
- Aluguel: `>= 0`, até 2 casas decimais.
- Linhas com taxa = 0 ficam sinalizadas em amarelo ("não configurado").

## Fora do escopo (próximas etapas)
- Cálculo de recebível líquido por cobrança (MDR + rateio de aluguel).
- Coluna "Valor líquido" em Financeiro > Contratos e nos relatórios.
- Histórico/versionamento de taxas por data de vigência.
