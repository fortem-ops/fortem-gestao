# Planos 2027 — Fase 3: Cobrança e pagamento

Fases 1 e 2 concluídas (catálogo 2027 desligado; 5 contratos 2027 desligados; escolha de contrato por `catalogo_id`). Nada desta fase muda contratos, cobranças ou créditos já existentes. O cron `cobrar-recorrencias-diario` continua desligado (confirmado: active=false).

## 1. Como a venda funciona hoje (verificado)

```text
VendaDialog -> INSERT vendas
   trigger fn_processar_venda -> cria planos + crédito Treino (na hora)
   recorrencia  -> fn_criar_contrato_recorrencia  -> contratos(ativo) + N cobrancas (1a paga só se dinheiro/PIX/débito)
   tradicional  -> fn_criar_contrato_tradicional  -> contratos(ativo) + N cobrancas iguais
   criarCreditosServicos (cliente) -> creditos_aluno dos serviços
   cartão online / link -> venda-pos-aprovacao.ts cria contrato e cobranças só após aprovação da Rede
Aceite (contrato/:token) -> só registra assinatura; não ativa nada
```

- Plano e créditos ficam ativos na hora da venda, mesmo com `status_pagamento = pendente` (exceto cartão online/link).
- Cobranças mensais são todas criadas no contrato (`numero_ciclo` 1..N); o cron só cobra as existentes.
- Taxa de recorrência atual: `TAXA_MENSAL_RECORRENCIA = 20` fixa em `vendas-calc.ts` (2027 precisa usar `planos_catalogo.taxa_recorrencia` = 24,90).
- Serviços: matriz fixa por nome em `vendas-servicos.ts` (Start+/Power/Pro/Max) — não serve para 2027.
- `pix-webhook` atualiza `pix_cobrancas`, `pagamentos` e vendas da Corrida, mas **não dá baixa em `cobrancas`** de mensalidade.
- Hoje: 0 linhas em `pix_recorrencias`, 17 em `pix_cobrancas`, 0 créditos com `competencia`.

## 2. Fluxo 2027 proposto (ponta a ponta)

1. Venda: escolher item 2027 (familia + frequência + modalidade) e serviços 2027 de `servicos_catalogo` (não da matriz antiga).
2. Valores calculados por uma função pura nova `calcularVenda2027` (testada):
   - Start: mensal = valor do item; sem taxa; serviços à parte (até 6x cartão ou PIX à vista).
   - Power/Pro 12x: total = anual + serviços; PIX à vista = total sem desconto; cartão até 12x, parcela = (anual + serviços)/12.
   - Power/Pro recorrência: mensal = valor do item (24,90 já incluído no valor cobrado); serviços em venda separada.
3. Grava venda + contrato com `status = pendente` e `catalogo_id`; gera link de contrato (Fase 2) e, se for o caso, link de pagamento.
4. Aceite do contrato.
5. Pagamento aprovado (1a mensalidade, PIX à vista, ou cartão autorizado) ou baixa manual da 1a parcela.
6. Ativação: contrato `ativo`, plano ativo, créditos liberados.

Legado continua exatamente no caminho atual.

## 3. Liberação de créditos

Proposta: liberar **no pagamento confirmado da 1a parcela/à vista** (ou baixa manual dela), não na criação nem no aceite.
- Riscos de liberar na criação (como hoje): aluno agenda e usa sem pagar; estorno de crédito difícil.
- Riscos de liberar no pagamento: atraso entre venda e uso quando a baixa é manual — mitigado com botão "Liberar agora" (coordenador/admin, registrado em auditoria).
- Inadimplência depois da ativação: créditos já liberados ficam; parcelas seguem devidas (contrato).

Rotina mensal (só descrita, implementar na 3C):
- Diária, idempotente pelo índice único (origem_id, atividade, competencia).
- Start: para cada plano 2027 ativo com `liberacao_creditos = mensal`, criar crédito Treino da competência (4/8/12) com validade no fim da competência; o anterior expira sem acúmulo. Livre: crédito ilimitado.
- Pro: crédito "Bota de compressão" 4/mês, mesma regra, só dentro da vigência.
- Só gera se a mensalidade da competência estiver paga ou dentro da tolerância (decisão aberta, pergunta 2).

## 4. Parcelas 12x com serviços

- Uma venda do plano e uma venda por serviço (relatórios e repasse continuam separados), ligadas ao mesmo contrato.
- `cobrancas`: 12 linhas, valor = (anual + serviços)/12, descrição "Parcela n/12 — Power 2x + Nutri 4"; arredondamento: diferença de centavos na última parcela.
- Nova coluna em `cobrancas` com a composição (ex.: `composicao jsonb` {plano, servicos:[{venda_id, valor}]}) para saber quanto de cada parcela é serviço.
- Rescisão: `calcRescisao` ganha caminho 2027 — parte do plano segue a tabela 75/80/85%; parte de serviços continua devida integralmente (parcelas restantes não são canceladas na parte de serviço).

## 5. Baixa manual da recorrência

Existe: baixa por cobrança em `ContratoFinanceiro.tsx` com forma e data, propagando para a venda (`baixaVenda.ts`); aviso de multa pendente.
Falta:
- Lista "Mensalidades a receber" (todas as recorrências em aberto do mês) com baixa em lote (`propagarBaixaEmLote` existe mas não tem tela).
- Na baixa da 1a mensalidade 2027, disparar a ativação (item 3).
- Filtro por recorrência cartão/PIX Automático.

## 6. Relatórios, comissionamento e previsibilidade

- Relatórios agrupam por texto (`tipo`/`plano_tipo`). Proposta: agrupar 2027 por `familia` + `versao` via `catalogo_id`; legado segue pelo texto.
- Repasse de serviços: `custo_repasse_unitario` hoje não é lido por nenhum código. Proposta: gerar repasse por sessão consumida (Nutri R$ 200 por consulta, Reabilitação R$ 80 por sessão, Avaliação R$ 100) a partir do consumo; avaliação avulsa com `gera_pendencia_comissao = false` não cria pendência. Nada aparece para o aluno.
- Previsibilidade: as 12 parcelas e as mensalidades entram como recebíveis; separar origem "mensalidade" e "servico" usando a composição da parcela. Definição SQL das funções de previsibilidade a confirmar na 3E.

## 7. Teste PIX Automático (R$ 1)

Existe: `pix-criar-recorrencia`, `pix-criar-cobranca`, `pix-cancelar-recorrencia`, `pix-solicitar-confirmacao`, `pix-webhook`, tabelas `pix_recorrencias`/`pix_cobrancas`, tela `PixAutomaticoSection`; credenciais `INTER_*`, ambiente definido só pelo segredo `INTER_BASE_URL` (sem chave de sandbox no código).
Falta: baixa em `cobrancas` quando a cobrança Pix é liquidada; vínculo `pix_cobrancas` -> `cobrancas`; checar se a integração atual tem permissão de Recebimentos recorrentes.

Passo a passo (só com seu pedido, cada passo confirmado):
1. Confirmar qual integração do Inter está nos segredos e se é produção (não há sandbox configurado).
2. Aluno de teste com seu CPF (pagador autorizado por você); nenhum aluno real.
3. Criar recorrência R$ 1,00, mensal, com data_fim = 1 mês (limita a 1 cobrança).
4. Você autoriza no app do banco; conferir status AUTORIZADA via webhook.
5. Criar uma cobrança de R$ 1,00; conferir LIQUIDADA, `pagamentos` e (após correção) `cobrancas`.
6. Rollback: cancelar a recorrência (`pix-cancelar-recorrencia`), marcar linhas de teste e excluí-las do financeiro; R$ 1 fica como receita de teste.
7. Só depois do teste OK, liberar "PIX Automático" como opção na venda 2027.

## 8. Fases menores

- 3A: cálculo de valores 2027 + testes (sem banco).
- 3B: venda 2027 no VendaDialog (serviços do catálogo, contrato pendente, links) + composição das parcelas.
- 3C: ativação no pagamento/baixa + liberação de créditos + rotina mensal Start/bota.
- 3D: baixa em lote das mensalidades + rescisão 2027.
- 3E: relatórios por familia/versao, repasse de serviços, previsibilidade.
- 3F: teste PIX Automático e correção do webhook -> `cobrancas`; habilitar opção.

## 9. Consultas de conferência

```sql
-- cron segue desligado
select jobname, active from cron.job where jobname = 'cobrar-recorrencias-diario';
-- vendas 2027 e seus contratos
select v.id, c.status, c.forma_pagamento, pc.familia, pc.versao
from vendas v join contratos c on c.id = v.contrato_id join planos_catalogo pc on pc.id = c.catalogo_id
where pc.versao = 2027;
-- parcelas 12x: soma = anual + serviços
select contrato_id, count(*), sum(valor) from cobrancas
where contrato_id in (select id from contratos where catalogo_id is not null) group by 1;
-- créditos mensais sem duplicidade
select origem_id, atividade, competencia, count(*) from creditos_aluno
where competencia is not null group by 1,2,3 having count(*) > 1; -- esperado 0
-- teste Pix
select id_rec, status, valor_minimo from pix_recorrencias;
select txid, status, valor from pix_cobrancas order by created_at desc limit 5;
```

## 10. Perguntas em aberto

1. Créditos liberados no pagamento da 1a parcela (proposta) ou na criação da venda como hoje?
2. Crédito mensal do Start/bota: liberar só se a mensalidade da competência estiver paga?
3. A taxa de 24,90 já está somada no `valor` do item 2027 ou deve ser somada na cobrança? (o catálogo guarda as duas colunas; confirmar antes da 3A)
4. Recorrência 2027 sem cartão salvo nem Pix: baixa manual por mensalidade — gerar as 12 cobranças de uma vez (como hoje) ou uma por mês?
5. Teste Pix: em produção com a integração atual (não há sandbox) — de acordo?
