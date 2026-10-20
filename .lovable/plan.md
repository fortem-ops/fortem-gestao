# Vendas manuais 2027 recorrentes no cron novo

Este é só um plano. Nada fica ligado sem aprovação do dono. Planos 1 E4–E6, Plano 2 (Pix Automático), flags, cron legado e checkout público não mudam.

## Fatos conferidos (20/10)
- O cron `planos-recorrencia-diario` cobra apenas `planos_2027_mensalidades`. Ele usa `fn_recorrencia_2027_devidas`, `_reservar`, `_resultado_rede` e `_incertas`.
- Em `planos_2027_mensalidades`, os campos `proposta_id` e `tokenizacao_id` são obrigatórios. `contrato_id` e `cobranca_id` já existem e podem ficar vazios. Uma venda manual não tem proposta, por isso hoje não consegue gerar mensalidades.
- Larissa: a única cobrança é a do ciclo 1 (`c62a0a8a…`, 20/10, R$ 403,00, **paga**). Não há cobrança nº 2 nem mensalidades. Sem mudança, nada seria cobrado em 20/11.
- Hoje a Larissa é a **única** venda manual 2027 recorrente ativa: venda `8bfa4dea…`, R$ 403,00, próximo vencimento 20/11/2026, 0 mensalidades. A lista será conferida de novo antes de qualquer escrita.

## A) Como as mensalidades passam a existir
**Opção recomendada:** criar as mensalidades no momento da venda manual. Elas usam a mesma tabela e o mesmo cron, sem criar um segundo caminho de cobrança.
- Liberar `proposta_id` vazio quando a mensalidade tiver `contrato_id` e uma nova marca `origem='manual'`. A regra fica garantida por uma checagem no banco. É uma mudança só de acréscimo.
- Ao confirmar o pagamento do ciclo 1 (pela liquidação atômica da migration 0177), gerar as mensalidades nº 2..N:
  - Start: até o fim do contrato.
  - Power/Pro recorrente: 12 meses.
  - Valor e vencimento são copiados das cobranças do contrato, incluindo o desconto recorrente do Start.
  - A tokenização usada é a do cartão vinculado ao contrato.
  - Cada mensalidade aponta para a sua `cobrança` espelho, como já acontece nas vendas do site (fase B).
- A seleção do cron passa a aceitar origem manual e continua exigindo `numero>1`.
- **Opção descartada:** fazer o cron ler `cobrancas` direto. Seria uma segunda forma de cobrar, com travas diferentes e mais risco de cobrar duas vezes.

**O que muda para a equipe na ficha do aluno:** as próximas cobranças aparecem como pendentes e são baixadas sozinhas quando a Rede aprovar.
- Os créditos do ciclo continuam saindo só de `fn_creditos_mensais_2027`/`fn_renovar_start_2027`.
- O cancelamento e a multa de 25/20/15% seguem o contrato. Ao cancelar, as mensalidades futuras passam para "cancelada", com a mesma regra das vendas do site.
- A baixa manual (Pix/dinheiro) continua por `baixa_manual_por`.

## B) Regularizar a Larissa
- Fazer uma única transação com trava: gerar as mensalidades nº 2.. a partir de 20/11, com R$ 403,00 e a tokenização `784ffe01…`, ligadas ao contrato `9cb790f2…` e às cobranças espelho novas.
- **Não** criar a nº 1, porque o ciclo 1 já está pago e vinculado.
- Conferir antes de gravar: contrato ativo, cartão `935b6837…` ativo, nenhuma mensalidade existente e cobrança do ciclo 1 paga.
- Será entregue um script de reversão: ele apaga apenas o que tiver sido gerado e ainda não tiver sido cobrado.

## C) Salvaguardas
- Não cobrar duas vezes:
  - Índice único por (contrato, número) nas mensalidades.
  - O cron recusa o número 1 de qualquer contrato manual.
  - A reserva só aceita mensalidade pendente cuja cobrança espelho não esteja paga.
  - A trava advisory por mensalidade e a idempotência de `pagamentos_rede` continuam valendo.
  - Uma cobrança paga por fora (baixa manual) tira a mensalidade da fila.
- **Se o cartão falhar:** segue o fluxo atual das vendas do site, com as mesmas retentativas, o status de inadimplência e o aviso para admin/coordenação. Nada novo é inventado.
- **Troca de cartão:** quando a equipe vincular outro cartão ao contrato, as mensalidades pendentes passam para a nova tokenização. As já reservadas ou incertas não mudam.

## D) Riscos, aprovações, testes, ordem
- **Riscos:**
  - Valor errado nas mensalidades. Mitigação: cópia exata da cobrança espelho, com teste ao centavo.
  - Venda manual antiga sem cartão vinculado. Nesse caso nada é gerado e a equipe recebe um aviso.
  - Contrato cancelado com mensalidades pendentes.
- **Depende do dono:**
  1. Aprovar este plano.
  2. Aprovar a geração para a Larissa.
  3. Aprovar a regra de Power/Pro recorrente (12 meses).
- **Testes:**
  - Testes do cálculo e da seleção do cron.
  - Ensaio no banco com NICOLAS TESTE, desfeito no final (rollback), em modo simulação e sem Rede: geração, recusa da nº 1, reexecução idempotente, cancelamento e troca de cartão.
- **Ordem de entrega:**
  1. Mudança no banco.
  2. Geração na venda manual.
  3. Seleção do cron.
  4. Ensaio.
  5. Publicação das funções.
  6. Regularização da Larissa, antes de 20/11.
- **Estimativa:** cerca de 6 a 10 mensagens de trabalho.
