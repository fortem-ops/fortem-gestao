# Baixa da multa de cancelamento sempre visível

## Problema
O botão "Registrar pagamento da multa" só existe no aviso "Próximos passos" que aparece logo após confirmar um cancelamento. Se a tela for fechada ou recarregada, o aviso some e a baixa da multa só fica acessível procurando a cobrança na lista — como aconteceu com a Olivia (multa de R$ 239,40 já criada, pendente, venc. 15/10).

## O que será feito

Arquivo alterado: apenas `src/pages/alunos/ContratoFinanceiro.tsx`.

1. **Aviso permanente de multa pendente**: enquanto existir cobrança de multa em aberto (numero_ciclo = 999, status pendente) em qualquer contrato encerrado do aluno, mostrar um card de alerta laranja no topo da aba Contrato/Pagamentos com:
   - valor da multa e vencimento;
   - botão **"Dar baixa na multa"** que abre o mesmo diálogo de baixa manual já existente (data + forma de recebimento), reutilizando `pedirBaixa`/`handleBaixa` — sem nenhuma lógica nova de pagamento;
   - o aviso desaparece sozinho após a baixa (a query `cobrancas-historico` já é invalidada no fluxo de baixa).
2. **Fonte dos dados**: reutilizar a query `cobrancasHistorico` existente (já traz todas as cobranças dos contratos encerrados, incluindo a multa) — nenhuma query nova.
3. **Sem efeito colateral**: nada muda para contratos sem multa, para o aviso pós-cancelamento já existente, nem em nenhuma outra tela.

## Verificação
- Abrir a ficha da Olivia (contrato cancelado, multa pendente) e confirmar que o aviso aparece com R$ 239,40 e venc. 15/10.
- Clicar em "Dar baixa na multa", registrar o recebimento e confirmar que o aviso some e a cobrança fica paga.
- Conferir que um aluno sem multa não mostra o aviso.
