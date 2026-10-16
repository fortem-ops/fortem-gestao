# Venda paga = cobranças pagas

## O que foi confirmado

- A venda do Matheus Rigoni (Power 2x, R$ 5.148,00, cartão de crédito em 12x, registrada pela equipe) está como **Paga**. Ela foi marcada como paga às 16:04 de hoje.
- As 12 parcelas de R$ 429,00 desse contrato, em Cobranças, continuam **Pendente**.
- **Causa:** o sistema só faz a baixa num sentido. Dar baixa numa cobrança marca a venda como paga. Marcar a venda como paga, ou criá-la já paga, não mexe nas cobranças.
- **Não é um caso isolado.** Nos últimos 60 dias há vendas pagas com cobranças pendentes:
  - cartão de crédito: 138 parcelas;
  - Pix: 10;
  - cartão recorrente: 11.

## Regra proposta

Quando uma venda de plano ou serviço fica **Paga**, seja ao ser criada ou ao ter o status mudado:

- **Cartão de crédito (à vista ou parcelado na maquininha/link), Pix à vista e dinheiro:** todas as cobranças pendentes ou atrasadas do contrato passam a **Pago**, com a data de pagamento da venda. A operadora do cartão paga a FORTEM pelo total, então o aluno não deve mais nada.
- **Cartão recorrente e Pix Automático:** só a 1ª parcela passa a **Pago**. As outras continuam pendentes, porque serão cobradas mês a mês.
- Cobranças canceladas ou já pagas não mudam.
- Se a venda voltar de Paga para Pendente, nada é desfeito automaticamente; a equipe ajusta à mão. Assim nenhum pagamento real é apagado por engano.

## Acerto dos casos antigos

1. Monto a lista de cada contrato afetado: aluno, venda, forma de pagamento e parcelas que mudariam.
2. Você confere a lista.
3. Só depois de aprovada, aplico a mudança e guardo um backup para poder desfazer.

O Matheus entra nessa lista. Se preferir, ajusto só ele primeiro.

## Detalhes técnicos

- Trigger `AFTER INSERT OR UPDATE OF status_pagamento ON vendas` quando `NEW.status_pagamento='pago'` e o anterior ≠ pago:
  - localizar o contrato por `vendas.cobranca_id` → `cobrancas.contrato_id`; senão `contratos` com mesmo `aluno_id` + `plano_id`, o mais recente;
  - `modalidade_pagamento/forma_pagamento` in (`cartao_parcelado`, `cartao_credito`, `cartao_credito_maquininha`, `pix` à vista, `dinheiro`): `UPDATE cobrancas SET status='pago', data_pagamento=vendas.data_venda` onde `status in ('pendente','atrasado')` e `numero_ciclo <> 999` (multa fica de fora);
  - `cartao_recorrencia`/Pix Automático: só `numero_ciclo=1`;
  - registro em `system_logs` (venda, contrato, ids das cobranças).
- Não chama Inter nem Rede, e não gera cobrança nova. Fica idempotente: só afeta pendente/atrasado.
- `propagarBaixaParaVenda` continua igual, sem laço: o trigger só age na transição para pago.
- Backfill por consulta com prévia, backup em `scripts/baixa-vendas-pagas.backup.sql` e rollback.
- Teste para a regra: parcelado = todas pagas; recorrente = só a 1ª.
- Não mexe em Planos 1 e 2, nas flags, na recorrência automática nem nos templates de contrato.
