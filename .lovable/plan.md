## Mudanças

**1. `src/pages/alunos/ContratoFinanceiro.tsx` (linha 103)**
- Alterar `.order("data_vencimento", { ascending: false })` para `ascending: true`, exibindo as cobranças do passado ao futuro na timeline do Perfil do Aluno > Contrato.

**2. `src/pages/financeiro/Contratos.tsx` (linha 148)**
- Tornar o nome do aluno clicável, navegando para `/alunos/{aluno_id}?tab=contrato` (mesma rota usada no contexto atual).
- Implementação: envolver `c.alunos?.nome` em um `<Link to={`/alunos/${c.aluno_id}?tab=contrato`}>` com estilo de hover (sublinhado/cor primária) mantendo `font-medium`.

Nenhuma alteração de lógica de negócio ou backend.