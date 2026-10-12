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
   - Power/Pro recorrência: cobrança mensal = valor do catálogo + 24,90 (ex.: Power 2x = 453,90); 12 cobranças criadas de uma vez; serviços em venda separada.
3. Grava venda + contrato (ativo na venda, como hoje) e `catalogo_id`; gera link de contrato (Fase 2) e, se for o caso, link de pagamento.
4. Aceite do contrato.
5. Pagamento aprovado (1a mensalidade, PIX à vista, ou cartão autorizado) ou baixa manual da 1a parcela.
6. Plano e créditos já ativos desde a venda; o pagamento só dá baixa.

Legado continua exatamente no caminho atual.

## 3. Liberação de créditos

Decidido: créditos do plano e dos serviços liberados **na venda** (como hoje), sem esperar o pagamento. Venda pendente fica visível (status_pagamento) para rastrear quem não pagou. Legado sem mudança.
- Risco aceito: aluno usa créditos sem pagar; mitigação = lista de vendas 2027 pendentes.

Rotina mensal (só descrita, implementar na 3C):
- Diária, idempotente pelo índice único (origem_id, atividade, competencia).
- Start: para cada plano 2027 ativo com `liberacao_creditos = mensal`, criar crédito Treino da competência (4/8/12) com validade no fim da competência; o anterior expira sem acúmulo. Livre: crédito ilimitado.
- Pro: crédito "Bota de compressão" 4/mês, mesma regra, só dentro da vigência.
- Decidido: só gera se a mensalidade da competência estiver paga, com tolerância curta de dias configurável.

## 4. Parcelas 12x com serviços

- Uma venda do plano e uma venda por serviço (relatórios e repasse continuam separados), ligadas ao mesmo contrato.
- `cobrancas`: 12 linhas, valor = (anual + serviços)/12, descrição "Parcela n/12 — Power 2x + Nutri 4"; arredondamento: diferença de centavos na última parcela.
- Nova coluna em `cobrancas` com a composição (ex.: `composicao jsonb` {plano, servicos:[{venda_id, valor}]}) para saber quanto de cada parcela é serviço.
- Rescisão: `calcRescisao` ganha caminho 2027 — parte do plano segue a tabela 75/80/85%; parte de serviços continua devida integralmente (parcelas restantes não são canceladas na parte de serviço).

## 5. Baixa manual da recorrência

Existe: baixa por cobrança em `ContratoFinanceiro.tsx` com forma e data, propagando para a venda (`baixaVenda.ts`); aviso de multa pendente.
Falta:
- Lista "Mensalidades a receber" (todas as recorrências em aberto do mês) com baixa em lote (`propagarBaixaEmLote` existe mas não tem tela).
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

- 3A: FEITO — `src/lib/vendas2027.ts` (`calcularVenda2027`) + `src/test/vendas2027.test.ts`.
- 3B: venda 2027 no VendaDialog (serviços do catálogo, contrato pendente, links) + composição das parcelas.
- 3C: rotina mensal Start/bota (só com mensalidade paga + tolerância).
- 3D: baixa em lote das mensalidades + rescisão 2027.
- 3E: relatórios por familia/versao, repasse de serviços, previsibilidade.
- 3F (só com pedido): teste PIX Automático e correção do webhook -> `cobrancas`; habilitar opção.

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

## 10. Decisões tomadas

1. Créditos liberados na venda. 2. Crédito mensal/bota só com mensalidade paga + tolerância configurável. 3. Teste Pix em produção com R$ 1, na 3F, sob pedido. 4. Taxa 24,90 somada ao valor do catálogo; contratos 2027 de recorrência já mostram `%VALOR_MENSAL%` = valor + taxa ("já incluída a taxa"), coerente — nada a corrigir. 5. 12 cobranças criadas de uma vez.

---

# Fase 3B — concluída (registro)

Decisões do dono aplicadas: só admin vende 2027; ciclo mensal = dia da venda até a véspera do mesmo dia do mês seguinte; Power/Pro sempre 12 meses (itens `_mensal` são só o preço da recorrência); recorrência Power/Pro = 12 cobranças de preço + R$ 24,90; 1º vencimento na venda ou data escolhida; Pro = 2 Avaliações Funcionais (1º e 6º mês) criadas na venda; Nutri 4 = 4 Nutrição + 2 Composição Corporal; brindes não gravados na venda; vendas de teste com `origem='teste_2027'`, nunca apagadas sem pedido.

Migrations:
- 0085_venda_2027: `cobrancas.composicao`, `fn_venda_2027_criar(jsonb)` (admin), early-return 2027 em `fn_processar_venda` (legado provado igual por diff e simulação com rollback).
- 0086_venda_servicos_2027: `fn_venda_servicos_2027_criar(jsonb)` (só serviços, sem contrato).
- 0087_venda_2027_fix_af_meses: leitura de `avaliacoes_funcionais_meses` (int[]).
Também: `renovar-planos-mensais` ignora `catalogo_id` preenchido; UI `Venda2027Steps` no VendaDialog (admin).

Cenários executados (todos `teste_2027`): Start 2x recorrência; Power 1x anual 12x + Nutri 4 + Reab 4 (12 x 514); Pro 3x recorrência + Nutri 8 em 6x (12 x 623,90 + 6 x 400); Pro Livre Pix (1 x 8.388); Avaliação avulsa (venda 200). Erro encontrado depois: Start 2x saiu com 12 cobranças e vigência 12 meses — corrigido na 3B.1 abaixo.

# Fase 3B.1 — Correção do Start 2027

## Como o Start legado funciona hoje (lido no código e no banco)
- 21 planos Start ativos: contrato `vigencia_tipo = mensal`, **1 cobrança por contrato**, `renovacao_automatica = true`, `proxima_renovacao = data_fim`.
- Cron `renovar-planos-mensais-daily` (03:00, ativo) chama `renovar-planos-mensais`: busca planos ativos com renovação automática e `proxima_renovacao <= hoje`; pula se houver plano mais novo da mesma atividade, se o 1º ciclo não terminou ou se já houve renovação nas últimas 20h; **desativa o plano atual** e insere uma **nova venda** (`origem = renovacao_automatica`, data = `proxima_renovacao`). O gatilho `fn_processar_venda` cria o novo plano, o novo contrato mensal, a cobrança do ciclo e os créditos do ciclo.
- Ou seja: cada ciclo = 1 venda + 1 plano + 1 contrato + 1 cobrança + créditos. Créditos do novo ciclo saem sem conferir pagamento.
- (Start+ legado é anual com até 12 cobranças — não é o modelo do Start 2027.)

## Correção proposta (mesmo desenho, caminho 2027 separado)
a) Venda Start 2027 (`fn_venda_2027_criar`, ramo `familia = start_2027`): cria 1 cobrança (o 1º ciclo), contrato e plano `vigencia_tipo = mensal`, `data_fim = fim do ciclo + 1 dia` (mesmo dia do mês seguinte), `renovacao_automatica = true`, `proxima_renovacao = data_fim`, sem fidelidade, créditos do 1º ciclo (4/8/12 ou ilimitado, `competencia` = início, validade = véspera). Power/Pro sem mudança.
b) Renovação: nova função SQL `fn_renovar_start_2027(plano_id, data_ref)` (idempotente) chamada por um ramo novo em `renovar-planos-mensais`, só para planos com `catalogo_id` de `familia = start_2027`. O ramo legado (`catalogo_id is null`) continua byte a byte igual. A função segue o desenho legado: encerra o plano/contrato do ciclo, cria venda `origem = renovacao_automatica` com `catalogo_id` 2027, novo plano + contrato mensal + 1 cobrança (usando `fn_venda_2027_criar` internamente com flag de renovação, sem checagem de admin) — **mas os créditos do novo ciclo só nascem se a cobrança do ciclo estiver paga**, com tolerância (ver 3C).
c) Legado intocado: filtro por `catalogo_id`; prova repetindo diff da função e simulação com rollback de uma renovação Start legada antes/depois.

# Fase 3C — Rotina mensal de créditos (descrição, não implementar)

Parâmetro: `sistema_config.chave = 'creditos_2027_tolerancia_dias'` (padrão 3).

Nova função `fn_creditos_mensais_2027(data_ref date)`, rodada diariamente (pelo mesmo cron, depois da renovação), idempotente pelo índice único (origem_id, atividade, competencia) com `ON CONFLICT DO NOTHING`:
1. Start 2027 — para cada plano ativo cujo ciclo vigente ainda não tem crédito de Treino: libera 4/8/12 (ou ilimitado) se a cobrança do ciclo está paga, ou se `hoje <= vencimento + tolerância` (liberação provisória). Se passar da tolerância sem pagamento, não libera e grava `system_logs`. Paga depois, libera na próxima rodada (validade = fim do ciclo, não estende).
2. Bota do Pro 2027 — ciclos de 1 mês a partir de `data_inicio`, 12 ciclos: 4 créditos por ciclo, `competencia` = início, validade = véspera do ciclo seguinte. Sem acúmulo (sobra vence com o ciclo).
   - Pro em recorrência: mesma regra de cobrança do ciclo (`numero_ciclo` = índice do ciclo) paga ou dentro da tolerância.
   - Pro em 12x/Pix à vista: libera sem condição de pagamento.
3. Nunca toca créditos com `competencia` nula nem planos legados.

## Cenários de aceite (3B.1 + 3C)
1. Start 2x vendido 25/10: 1 cobrança 25/10, Treino 8 válido até 24/11, renovação em 25/11.
2. Renovação 25/11 com cobrança de outubro paga: novo contrato/cobrança 25/11, Treino 8 (comp. 25/11, validade 24/12); sobra de outubro não soma.
3. Renovação com mensalidade em aberto: cobrança do novo ciclo criada; crédito liberado até venc.+tolerância; depois disso, sem crédito e com log.
4. Rodar a rotina 2x no mesmo dia: nenhum crédito duplicado.
5. Pro 3x recorrência: bota 4 no ciclo 2 só com cobrança 2 paga/tolerância; Pro Livre Pix: bota 4 todo ciclo sem condição; nada após o 12º ciclo.
6. Start legado: renovação idêntica à atual (simulação antes/depois).

## Consultas de conferência
```sql
-- 1 cobrança por contrato Start 2027
select k.id, count(c.id) from contratos k join planos_catalogo pc on pc.id=k.catalogo_id
left join cobrancas c on c.contrato_id=k.id where pc.familia='start_2027' group by 1;
-- créditos mensais sem duplicidade
select origem_id, atividade, competencia, count(*) from creditos_aluno
where competencia is not null group by 1,2,3 having count(*)>1;
-- bota por ciclo
select origem_id, competencia, quantidade_inicial, data_validade from creditos_aluno
where atividade='Bota de compressão' order by 1,2;
-- legado sem créditos com competência
select count(*) from creditos_aluno cr join planos p on p.id=cr.origem_id
where p.catalogo_id is null and cr.competencia is not null;
```

## Dados de teste da 3B (Start 2x)
Nada é apagado sem pedido. Proposta: depois da correção, (1) marcar a venda de teste antiga como `cancelado` e suas 11 cobranças futuras como `cancelada`, com observação "teste 3B substituído" — só com sua autorização; (2) vender de novo um Start 2x de teste pelo fluxo corrigido em outro aluno de teste (ou o mesmo, após o cancelamento). Alternativa sem escrita: deixar a venda antiga como está e só criar a nova.

## Perguntas em aberto
1. Tolerância padrão: 3 dias está bom?
2. Start: o crédito provisório durante a tolerância é aceitável, ou só libera com pagamento?
3. Venda de teste Start antiga: cancelar (opção 1) ou deixar como está?
