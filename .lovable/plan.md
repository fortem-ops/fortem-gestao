# Plano 1 de 2 — Encargos por atraso nas recorrências 2027 + novo §5

Só planejamento. Nenhuma flag, dado, contrato ou cobrança será alterado até aprovação.

## Estado atual (conferido agora)
- O §5 da cláusula de pagamento é idêntico nos 3 modelos ativos de recorrência (start_2027, power_2027 e pro_2027, `cartao_recorrencia`, versão 2): "Em caso de atraso no pagamento incidirá multa de 2%, juros de 1% ao mês e correção monetária." O §4 trata da suspensão de acesso. Não existe nenhum cálculo de encargos no software, nem dados de IPCA.
- **Divergência a confirmar:** a mensagem diz que a recorrência no cartão está "congelada", mas no banco `planos_recorrencia_ativa = true` (cron novo de 2027, às 11:00 UTC). Só o cron legado está desligado (`cobranca_recorrente_ativa = false`). Este plano não muda nenhuma das duas flags. Se o dono quiser mesmo congelar, isso é um pedido separado.

## A) Regra de cálculo
Data-base: os encargos contam a partir do **dia seguinte ao vencimento**. A data final é a data do cálculo (ou do pagamento).
1. **Correção (IPCA):** fator = produto de (1 + IPCA do mês) para os meses do período de atraso. O mês parcial entra proporcional aos dias. Para meses ainda não divulgados, repete-se o **último IPCA publicado**. Se o fator acumulado ficar abaixo de 1, usa-se 1 (o valor nunca diminui). Principal corrigido = parcela × fator.
2. **Multa:** 2% sobre o principal corrigido, uma única vez.
3. **Juros:** 1% ao mês pro rata die, simples, sem capitalização: principal corrigido × 0,01 × dias/30.
4. **Arredondamento:** cálculo em centavos inteiros, cada parcela arredondada meio-para-cima no fim de cada etapa. Total = corrigido + multa + juros.

Fonte: **BCB SGS série 433** (IPCA, variação mensal, JSON público e sem chave). Reserva: IBGE/SIDRA tabela 1737. Os valores ficam guardados num cache local. Se a fonte estiver fora do ar, usa-se o cache com o aviso "IPCA atualizado até mm/aaaa". Sem cache, a correção fica em 0 com o aviso "correção indisponível". A tela nunca trava.

Exemplos (parcela Pro 3x recorrência de R$ 623,90; os IPCAs são ilustrativos):
- **10 dias, sem IPCA aplicável:** multa R$ 12,48, juros R$ 2,08, total **R$ 638,46**.
- **45 dias, IPCA acumulado de 0,75%:** corrigido R$ 628,58, multa R$ 12,57, juros (1,5%) R$ 9,43, total **R$ 650,58**.
- **IPCA negativo (−0,20%):** fator 1, corrigido R$ 623,90, e seguem só multa e juros.

## B) Onde aparece
- Nas telas Ficha do aluno → Financeiro e Financeiro → cobranças: cada mensalidade 2027 vencida e não paga mostra "Valor atualizado" e um quadro com a memória de cálculo: principal, IPCA (período e fator), multa, juros, dias e total.
- **Nada é automático.** A equipe (coord/admin) escolhe uma de duas ações, e o sistema registra quem decidiu, quando, o valor e o motivo:
  - "Cobrar valor atualizado";
  - "Perdoar encargos": cobra só o principal, com motivo obrigatório.
- **Cartão (Rede):** a mensalidade original continua como está. A ação gera **uma cobrança avulsa** com o valor atualizado, enviada como link de pagamento (fluxo atual de `PagamentoLink`). O aluno digita o cartão (CIT). Não há cobrança automática com o cartão guardado e nada muda no cron de 2027. Na baixa, a mensalidade original fica marcada como quitada pela avulsa.
- **Pix:** a mesma ação gera um Pix avulso (cobrança imediata do Inter) com o valor atualizado. Isso só será ligado com pedido explícito, porque chama a API do Inter.
- Os encargos entram como receita "encargos por atraso", separada da mensalidade e sem comissão. O cancelamento da cobrança avulsa devolve a mensalidade ao estado "em aberto".
- O Pix à vista e o cartão parcelado em 12x (§6 da administradora) ficam fora.

## C) Novo texto proposto (versão 3, só para vendas novas)
Substituir o §5 nos três modelos de recorrência; o §4 fica como está.

> §5º Em caso de atraso no pagamento de qualquer mensalidade, seja por cartão de crédito em recorrência ou por PIX Automático, incidirão sobre o valor em atraso, a partir do dia seguinte ao vencimento e até a data do efetivo pagamento: (I) correção monetária pela variação acumulada do IPCA/IBGE no período, utilizando-se o último índice divulgado para os meses ainda não publicados, sem redução do valor em caso de variação negativa; (II) multa moratória de 2% (dois por cento), aplicada uma única vez sobre o valor corrigido; e (III) juros de mora de 1% (um por cento) ao mês, calculados de forma simples e proporcional aos dias de atraso (pro rata die), sobre o valor corrigido.
>
> §5º-A A CONTRATADA poderá, a seu critério e por liberalidade, dispensar total ou parcialmente os encargos previstos no §5º, sem que isso constitua novação ou renúncia ao direito de exigi-los em atrasos futuros.

Texto para validação jurídica, a cargo do advogado do dono.

Efeito no checkout e no ANEXO I:
- Contratos já aceitos guardam o próprio texto e hash, e não mudam.
- As propostas abertas que já têm aceite continuam com a versão 2.
- As novas pegam a versão 3 automaticamente, porque o checkout busca o modelo ativo.
- O bloco do ANEXO I e a §7 da cláusula 3ª não mudam.
- Uma proposta que estiver na tela de revisão na hora da troca vai ver "o contrato mudou" e reaceitar. É esperado, e a troca deve ser feita em horário de pouco movimento.

## D) Riscos, aprovações, testes e ordem
Riscos:
- Cobrança abusiva por erro de índice (mitigado pelo piso no fator 1 e pela memória de cálculo visível).
- Defasagem do IPCA.
- Juros/multa sobre a taxa de recorrência: a proposta é incluir, já que o valor da parcela inclui a taxa; o dono confirma.
- Confusão entre a mensalidade original e a avulsa (mitigada com vínculo e baixa conjunta).

Aprovações do dono:
1. Texto do §5/§5º-A, após o advogado.
2. Ordem do cálculo: correção primeiro, multa e juros sobre o corrigido.
3. Encargos incidem sobre a parcela cheia, com a taxa.
4. Pro rata do IPCA no mês parcial.
5. Recobrança no cartão por link (recomendado) ou com o cartão salvo (não recomendado).
6. Esclarecer o "congelado" versus `planos_recorrencia_ativa = true`.
7. Liberar o Pix avulso do Inter.

Ordem de entrega (cada etapa precisa de aprovação):
- **E1** — Cálculo puro + testes Vitest com os exemplos acima: dia 0, 1, 30 e 45 dias; IPCA negativo; sem índice; arredondamento.
- **E2** — Cache do IPCA + função de leitura do BCB, com reserva no SIDRA e aviso de falha. Sem cron novo, atualização sob demanda.
- **E3** — Tela com o valor atualizado e a memória de cálculo, só leitura.
- **E4** — Ações "cobrar atualizado / perdoar" com registro de auditoria e link de cartão. Teste em NICOLAS TESTE, simulação.
- **E5** — Pix avulso, só com autorização para chamar o Inter.
- **E6** — Migração dos 3 modelos para a versão 3, com script de volta e ensaio desfeito, preservando hashes aceitos.

Em todas as etapas: nenhuma cobrança real, nenhuma mudança de flag ou cron, balcão e legado intactos.

Estimativa: E1 ~2–3 créditos, E2 ~3–4, E3 ~3–4, E4 ~5–7, E5 ~3–4, E6 ~2–3. Total ~18–25 créditos.
