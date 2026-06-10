## Objetivo

Alunos com plano **VIP** não devem entrar na contagem de **Alunos Ativos** no Dashboard nem no cálculo de **comissionamento de carteira** dos professores. Devem aparecer em um **card próprio "VIP"** no topo do Dashboard, e continuam visíveis na lista/widget de Carteira (apenas excluídos da matemática da comissão).

## Mudanças

### 1. Banco — `get_dashboard_data` (migration)
Atualizar o CTE `alunos_stats` para:
- `ativos` = planos ativos cujo `tipo` **não está** em `('Gympass/Wellhub','Total Pass')` **e não é VIP** (`tipo` não começa com `vip`, case-insensitive).
- `agregadores` = inalterado (Gympass/Wellhub, Total Pass).
- **Novo** campo `vip` = planos ativos cujo `tipo` começa com `vip`.
- `licenca` = inalterado.

### 2. Banco — `fn_carteira_ativos_por_profissional` (migration)
Adicionar à cláusula `NOT IN ('Gympass/Wellhub','Total Pass')` uma condição extra que exclua VIP (`tipo NOT ILIKE 'vip%'`). Assim o bônus de carteira ignora VIP, e como consequência `fn_carteira_total_ativos` (usado para a meta mínima) também ignora.

### 3. Frontend — Dashboard
- `src/hooks/useDashboardData.ts`: adicionar `vip: number` ao tipo `alunos`.
- `src/components/dashboard/StatsCards.tsx`: incluir novo cartão **"VIP"** na primeira linha (ao lado de Ativos / Agregadores / Licença), usando ícone `Crown` e cor dourada (texto `text-[#D4AF37]`, alinhado à identidade visual do plano VIP).

### 4. Frontend — Carteira (sem mudanças funcionais)
`CarteiraWidget` e `CarteiraAlunos` continuam listando VIP (decisão do usuário). Nenhuma alteração necessária.

## Detalhes técnicos

```sql
-- get_dashboard_data, no CTE alunos_stats:
(SELECT COUNT(*) FROM planos_ativos
  WHERE tipo NOT IN ('Gympass/Wellhub','Total Pass')
    AND tipo NOT ILIKE 'vip%') AS ativos,
(SELECT COUNT(*) FROM planos_ativos
  WHERE tipo IN ('Gympass/Wellhub','Total Pass')) AS agregadores,
(SELECT COUNT(*) FROM planos_ativos
  WHERE tipo ILIKE 'vip%') AS vip,
(SELECT COUNT(*) FROM alunos_filtered WHERE status = 'licenca') AS licenca

-- fn_carteira_ativos_por_profissional, no EXISTS de planos:
AND p.tipo NOT IN ('Gympass/Wellhub','Total Pass')
AND p.tipo NOT ILIKE 'vip%'
```

Layout do Dashboard passa a ter 4 colunas na primeira linha (`grid-cols-2 md:grid-cols-4`) para acomodar o card VIP sem quebrar o layout responsivo.

## Arquivos tocados

- nova migration SQL (recria `get_dashboard_data` e `fn_carteira_ativos_por_profissional`)
- `src/hooks/useDashboardData.ts`
- `src/components/dashboard/StatsCards.tsx`

## Fora de escopo

- Regras de elegibilidade do VIP (controle manual).
- Outros indicadores/relatórios que somam alunos ativos (podem ser revisados depois, sob demanda).
