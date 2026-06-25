## Problema

Em **Financeiro > Contratos**, a coluna "Próxima cobrança" mostra `contrato.data_renovacao`, que na verdade é a **data final do contrato** (ex.: 11/05/2027 do GUILHERME ZAFFARI). No perfil do aluno, "Próxima cobrança" é calculada corretamente como a **primeira cobrança pendente** da tabela `cobrancas` (ex.: 11/07/2026).

## Correção

Alinhar a página `src/pages/financeiro/Contratos.tsx` (e o KPI de "Renovações em 30 dias") para usar a mesma regra do perfil: data da próxima cobrança pendente.

### Mudanças

1. **`src/hooks/useContratos.ts` — `useTodosContratos`**
   - Trazer as cobranças junto: `.select('*, alunos(id, nome, email), cobrancas(data_vencimento, status)')`.
   - Pós-processar cada contrato para anexar `proxima_cobranca`: menor `data_vencimento` entre as cobranças com `status = 'pendente'` (fallback `null`).

2. **`src/pages/financeiro/Contratos.tsx`**
   - Coluna "Próxima cobrança": exibir `c.proxima_cobranca` em vez de `c.data_renovacao` (com fallback "—").
   - KPI "Renovações em 30d": continuar usando `data_renovacao` (faz sentido, é o fim do contrato), apenas renomear o rótulo para **"Renovações em 30d"** já está ok — manter como está.

3. **Sem alterações de banco, RLS ou backend.** Apenas frontend/leitura.

### Fora do escopo
- Card do contrato no perfil (`CardContrato.tsx`) já mostra `data_renovacao` rotulada como "Próxima cobrança". O usuário pediu ajuste em "Financeiro > Contratos", então não toco aqui agora — posso ajustar depois se desejar.
