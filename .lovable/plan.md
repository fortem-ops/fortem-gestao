
Trigger de defesa no banco já aplicado ✅ — `trg_close_inadimplencia_on_pagamento` fecha automaticamente a inadimplência quando uma cobrança vira `pago`, e inadimplências antigas já foram regularizadas.

Falta aplicar as 4 edições de frontend abaixo (precisa de aprovação para sair do plan mode):

## 1. `src/pages/StudentProfile.tsx`
- Renomear labels das abas: **Financeiro → Carteira** e **Contrato → Pagamentos** (mantendo os `value` originais para preservar URLs `?tab=…`).
- Importar `DollarSign` e `VendaDialog`; adicionar estado `vendaOpen`.
- Adicionar botão **"Nova venda"** logo após o `EditStudentDialog` no header, abrindo o `VendaDialog` já existente.

## 2. `src/pages/alunos/ContratoFinanceiro.tsx` (`handleBaixa`)
- Após marcar a cobrança como paga, fechar `inadimplencias` com `cobranca_id = baixaCobranca.id` e `status='aberta'` (defesa em profundidade junto com o trigger).
- Invalidar `["inadimplencias-contrato", ativo?.id]` e `["inadimplencias-aluno", alunoId]`.

## 3. `src/components/student/StudentSummary.tsx`
- Nova query `["inadimplencias-aluno", student.id]` lendo `inadimplencias` em aberto do aluno.
- Adicionar cada inadimplência ao array `alerts` com mensagem  
  `"Inadimplência: Venc. DD/MM/AAAA · N dia(s) em atraso — R$ X,XX"`, severidade `urgente` se >7 dias.

## 4. Banco (já feito)
- Função `fn_close_inadimplencia_on_pagamento` + trigger `trg_close_inadimplencia_on_pagamento` em `cobrancas`.
- `UPDATE` retroativo regularizando inadimplências cujas cobranças já estavam pagas.

Confirma para aplicar as edições de frontend?
