# Liberar "Alterar dados da venda" para contratos anuais/recorrentes

## Situação atual

Na aba Contrato do aluno, o botão "Alterar dados da venda" só aparece quando o contrato tem forma de pagamento "cartão recorrência". Contratos anuais parcelados aparecem no banco com outras formas de pagamento ("pendente", "cartão parcelado", "máquina crédito"), então o botão fica escondido — é exatamente o caso do contrato aberto agora (anual, 12 parcelas, forma "pendente").

## O que muda

- O botão passa a aparecer em qualquer contrato ativo ou suspenso que tenha ao menos uma cobrança em aberto (pendente ou atrasada), independentemente da forma de pagamento e da vigência (mensal, semestral ou anual).
- Se todas as cobranças já estiverem pagas ou canceladas, o botão continua oculto (não há nada editável).
- O texto do diálogo deixa de falar em "contrato de recorrência" e passa a dizer que edita vencimento e valor das cobranças em aberto do contrato.
- A regra de edição dentro do diálogo não muda: só cobranças pendentes/atrasadas são editáveis; pagas e canceladas seguem bloqueadas.

## Detalhes técnicos

Arquivos:

- `src/pages/alunos/ContratoFinanceiro.tsx` (linha ~550): trocar a condição `podeCancelar && contrato.forma_pagamento === "cartao_recorrencia"` por `podeCancelar && cobrancas.some(c => c.status === "pendente" || c.status === "atrasado")`.
- `src/components/financeiro/AlterarDadosVendaDialog.tsx`: ajustar apenas o texto do `DialogDescription`.

Sem mudanças de banco, RLS ou lógica de gravação.
