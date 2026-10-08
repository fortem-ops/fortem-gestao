# Cancelamento da Olivia: multa e histórico de pagamentos

## O que encontrei

- Contrato anual Start Plus, cartão recorrência, R$ 399/mês, início 24/02/2026, cancelado hoje (08/10).
- Pela regra atual, ela está no 8º mês: multa de 15% sobre 4 mensalidades restantes (R$ 1.596) = **R$ 239,40** (+ serviços usados, se houver).
- **A cobrança da multa não foi criada.** O sistema não confere se a gravação deu certo, então qualquer falha passa em silêncio e a tela mostra "Contrato cancelado" mesmo assim. A causa exata da falha ainda não está confirmada (pode ter sido valor zerado na tela ou recusa do banco); confirmo antes de corrigir.
- **Os pagamentos existem**: 7 mensalidades pagas (fev a set). Mas:
  - Ela não tem nenhuma venda registrada (contrato antigo, anterior às vendas), e o quadro "Histórico de Pagamentos" só lê vendas — por isso aparece vazio.
  - Depois de cancelado, o contrato vai para "Histórico de contratos" (recolhido), que só lista mensalidades **em aberto** — as pagas somem da tela.

## O que muda

1. **Depois de confirmar o cancelamento**, aparece um resumo com os próximos passos: valor da multa, vencimento, e botões "Gerar link de pagamento" / "Registrar pagamento" da multa. Se algo falhar ao gravar, aparece erro claro (e não "cancelado com sucesso").
2. **Contrato cancelado no histórico** passa a mostrar todas as mensalidades (pagas, canceladas, em aberto) e a multa, com destaque quando houver multa pendente.
3. **Histórico de Pagamentos**: quando o aluno não tem venda registrada, mostra as mensalidades pagas dos contratos, para não parecer que nunca houve pagamento.

## Correção pontual da Olivia (após aprovação)

- Confirmar o valor da multa (R$ 239,40 + serviços, conforme o cálculo do sistema) e criar a cobrança pendente, vencimento em 7 dias. Nada é cobrado no cartão automaticamente.

## Detalhes técnicos

- `ContratoFinanceiro.handleCancelar`: checar `error` de cada update/insert (cobrancas, ciclos, planos, multa), abortar com toast destrutivo; reproduzir o insert da multa para confirmar a causa (RLS/constraint de `cobrancas` com `numero_ciclo=999`); invalidar `cobrancas-historico`.
- Novo estado pós-cancelamento com card de próximos passos (reaproveita GerarLinkPagamento / dialog de baixa existente).
- `cobrancasHistorico`: buscar todos os status; card do histórico lista pagas + multa (`meio_registro='multa_cancelamento'`).
- `HistoricoVendas`: fallback com cobranças pagas dos contratos quando não houver vendas.
