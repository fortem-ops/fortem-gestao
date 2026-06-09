## Plano VIP — colaboradores, familiares, parceiros

Adicionar o tipo de plano **VIP** ao catálogo, com 4 variantes mensais, cortesia (R$ 0,00), cor dourada e renovação automática mensal (igual Start/Gympass).

### 1. Catálogo (`planos_catalogo`)
Inserir 4 linhas via INSERT (sem schema change):

| Nome | Período | Frequência | Créditos | Valor | Cor | Ativo |
|---|---|---|---|---|---|---|
| VIP | 1 mês | 1x | 4 | 0,00 | #D4AF37 | true |
| VIP | 1 mês | 2x | 8 | 0,00 | #D4AF37 | true |
| VIP | 1 mês | 3x | 12 | 0,00 | #D4AF37 | true |
| VIP | 1 mês | livre | ilimitado | 0,00 | #D4AF37 | true |

### 2. Renovação automática
- `src/lib/planTipo.ts` → `isAutoRenewPlan` passa a reconhecer `vip` (qualquer variante mensal). Assim os formulários (`AddStudentDialog`, `EditStudentDialog`) e o importador setam `renovacao_automatica = true` ao criar planos VIP.
- Migration leve atualizando o trigger `trg_planos_autorenew_defaults` para incluir `tipo ILIKE 'vip%'` no match, e backfill dos planos VIP existentes (se houver) com `renovacao_automatica = true` + `proxima_renovacao` calculada.

### 3. UI — sugestões e filtros
- `src/lib/vendas.ts` → adicionar `"VIP"` em `PLANOS_SUGERIDOS` (aparece como sugestão em `AdminPlanos` e no autocomplete de cadastro).
- `src/components/student/StudentListFilters.tsx` → o filtro "Tipo de Plano" já é dinâmico (lê do catálogo), então as variantes VIP aparecem automaticamente após o INSERT. Sem mudança necessária.

### 4. Validação
- Conferir em **Admin → Planos** que aparecem as 4 linhas VIP douradas.
- Criar um aluno de teste com plano VIP 1x → confirmar que o plano nasce com `renovacao_automatica = true` e `proxima_renovacao` no próximo mês.
- Filtro de "Tipo de Plano" na listagem de alunos passa a mostrar "VIP" como opção.

### Fora de escopo
- Regras de elegibilidade (quem pode ganhar VIP — colaborador, familiar, parceiro): hoje é controle administrativo manual. Se quiser uma tag/categoria formal, é um próximo ciclo.
- Cobrança no gateway: VIP é R$ 0,00, então não passa pelo fluxo de pagamento mesmo gerando venda mensal de histórico.

### Arquivos tocados
- INSERT em `planos_catalogo` (4 linhas)
- Nova migration (trigger + backfill VIP)
- `src/lib/planTipo.ts`
- `src/lib/vendas.ts`
