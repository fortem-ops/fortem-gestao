## Corrigir "Situação financeira" no topo de Plano & Financeiro

Causa confirmada: a cobrança deste aluno (R$ 479,00, vencida em 22/10/2026) está gravada com status `atrasado`. O resumo do topo só lê cobranças com status `pendente`, por isso ignora a cobrança e mostra "Em dia".

### Mudança (só na tela, sem banco)
- Em `src/components/student/StudentPlanoFinanceiro.tsx`, o resumo passa a ler cobranças com status `pendente` ou `atrasado`.
- Conta como atraso: status `atrasado` ou `pendente` com vencimento antes de hoje (fuso de Brasília).
- "Próxima cobrança" segue mostrando a pendente mais próxima com vencimento de hoje em diante.

### Verificação
- Abrir este aluno e confirmar "Em atraso", "1 cobrança vencida · R$ 479,00".
- Conferir um aluno sem pendências: segue "Em dia".
