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

---
---

# Plano 2 de 2 — Pix Automático como recorrência no /planos (Start, Power, Pro)

Somente plano. O Plano 1 continua pendente e não será implementado. Nada de flags, dados, contratos ou cobranças muda.

## A) Viabilidade no Inter
O que o código e os testes de 13 e 15/10 já mostram:
- Já usamos estas chamadas: criar recorrência, pedir a confirmação ao aluno pelo app do banco (jornada 1), criar a cobrança de cada mês, cancelar e ler os avisos do banco.
- Correção sobre a mensagem: o teste com QR de 13/10 também passou pela **jornada 2**. A recorrência de NICOLAS TESTE voltou do Inter como `APROVADA` e marcada como jornada 2 (QR só com a autorização). Ou seja, a conta já aceita jornada 2.
- Campos já usados: `vinculo` (objeto, contrato, devedor), `calendario` (data de início, data de fim, periodicidade MENSAL), `valor` (valor fixo ou valor mínimo do recebedor) e `politicaRetentativa` (`PERMITE_3R_7D` = até 3 novas tentativas em 7 dias).
- O limite de valor que o dono vê no app do banco é o **valor máximo definido pelo pagador**. A FORTEM não controla esse teto.
- Cada mensalidade precisa ser criada **pelo menos 2 dias antes** do vencimento. A regra é do Banco Central, e o Inter já recusou uma cobrança com prazo menor.
- Confirmações chegam pelos avisos do banco já registrados (pix, rec, cobr), com consulta ao Inter como reserva.

O que ainda não está provado:
- **Jornada 3** (QR que paga a 1ª mensalidade na hora e já autoriza a recorrência): o Banco Central prevê essa jornada no guia ([2](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/automatico/guia_pix_automatico.pdf)), mas não está confirmado que a conta do Inter aceita. A documentação pública do Inter ([1](https://developers.inter.co/references/pix-automatico)) não deixou isso claro na leitura.
  - Teste proposto (precisa da aprovação do dono): NICOLAS TESTE, um único QR com cobrança imediata de **R$ 1,00** ligada à autorização da recorrência, paga pelo dono no app.
  - Esperado: o pagamento é liquidado e a recorrência fica `APROVADA` como jornada 3.
  - Se o Inter recusar, ficamos com o plano B, sem custo.

**Plano B (sem jornada 3):** um único QR de jornada 2 (autorização), mais um **Pix comum à vista** para a 1ª mensalidade, que já existe no /planos. O plano só ativa quando a 1ª mensalidade for paga **e** a autorização estiver aprovada.
- Risco: o cliente autoriza e não paga, ou paga e não autoriza.
- Tratamento: uma tela mostra as duas pendências. Depois de 24 h:
  - sem pagamento: a autorização é cancelada e a proposta expira;
  - pago sem autorização: o plano ativa como **Pix mensal manual** e a equipe é avisada.

## B) Como fica no checkout
- Nova opção "Pix Automático (recorrência)" nos 3 planos, com o mesmo preço do cartão em recorrência (taxa: ver D). Cartão, Pix à vista e 12x ficam como estão.
- Fluxo: escolha → cadastro → contrato + ANEXO I → tela Pix com QR/copia e cola e aviso do limite → acompanhamento ("autorização ✔ / 1ª mensalidade ✔") → ativação pela mesma rotina de hoje (`fn_checkout_2027_ativar`) → e-mail.
- Aviso de limite: "Se você definir um limite no app do banco, ele precisa ser de pelo menos R$ X (o valor da mensalidade)". Se o limite ficar abaixo, a mensalidade falha e conta como inadimplência.
- O que acontece em cada caso:
  - QR expirado: gera um novo QR com o mesmo aceite por até 24 h.
  - Cliente cancela a autorização no banco: o plano continua até o fim do ciclo pago, a equipe recebe um aviso interno e oferece cartão ou Pix manual.
  - Autorizou e não pagou: segue a regra do plano A ou do plano B.
- Reuso: `pix_recorrencias` e `pix_cobrancas` ganham o vínculo `proposta_id`; a tabela de mensalidades 2027 ganha uma origem "pix_automatico". A baixa usa a rotina idempotente que já existe.

## C) Cobranças seguintes
- Rotina diária nova, separada do cartão, que **só cria** a cobrança de cada mensalidade 3 dias antes do vencimento. A margem de 1 dia sobre o mínimo de 2 cobre falhas.
  - Uma cobrança por mensalidade, sem repetir: se o resultado for incerto, consulta antes de recriar.
  - Retentativas: as do próprio banco (3 tentativas em 7 dias). A FORTEM não cobra nada além disso.
- Situação de cada mensalidade: liquidada → paga; rejeitada ou expirada → inadimplente. Inadimplente leva a suspensão de acesso (§4), aviso interno e encargos do Plano 1 só quando a equipe decidir.
  - Start: segue a regra atual (sem pagamento até D+3, não abre novo ciclo).
  - Power e Pro: os créditos são mantidos.
- Aviso ao aluno: o próprio banco notifica antes do débito. A FORTEM não manda e-mail por mensalidade (mesma regra de hoje).
- Para a equipe: cada mensalidade aparece no financeiro, no contrato e na previsibilidade com a forma "Pix Automático", mais o estado da autorização no perfil do aluno.

## D) Contrato (texto proposto para validação jurídica)
- Os 3 modelos de recorrência ganham uma versão nova, só para vendas novas, que já cita cartão ou Pix Automático. Não precisa de um modelo separado: o §1 atual já fala em "cartão de crédito ou PIX Automático". Por isso, a forma `pix_recorrencia` usa o mesmo modelo `cartao_recorrencia`.
- Cláusulas propostas:
  > §6º Na modalidade PIX Automático, o ALUNO autoriza, em sua instituição financeira, débitos mensais em favor da CONTRATADA no valor da mensalidade, nas datas de vencimento, pelo prazo do contrato. Ele declara ciência de que eventual limite de valor fixado por ele em sua instituição não poderá ser inferior à mensalidade.
  >
  > §7º O cancelamento da autorização pelo ALUNO junto à sua instituição financeira não implica rescisão contratual. O ALUNO deverá indicar outra forma de pagamento, sob pena de inadimplência, aplicando-se o §4º e os encargos do §5º.
  >
  > §8º A rescisão antecipada segue a Cláusula de cancelamento (multa de 25%, 20% ou 15% sobre as parcelas vincendas), igual para cartão e PIX Automático.
- **Decisão pendente do dono: taxa de recorrência de R$ 24,90 no Pix Automático.**
  - Cobrar: preço igual ao do cartão. Ex.: Pro 3x R$ 623,90 por mês, R$ 7.486,80 em 12 meses.
  - Não cobrar: Pix fica R$ 24,90 por mês mais barato. Ex.: R$ 599,00 por mês, R$ 7.188,00 em 12 meses, ou R$ 298,80 a menos no ano. O texto do §2 passaria a citar a taxa só no cartão.

## E) Liberação em etapas e segurança
- Novas flags, todas **desligadas**: `planos_pix_automatico_ativo`, mais uma por plano (Start, Power, Pro). Ordem sugerida: Start → Power → Pro, cada etapa com decisão do dono.
- Testes só em NICOLAS TESTE, por simulação ou com no máximo R$ 1,00 real e só com autorização.
- Reversão: desligar a flag esconde a opção na hora. Autorizações já criadas continuam e podem ser canceladas pela equipe. Migrações sempre com script de volta.

## F) Riscos, aprovações, testes, ordem e créditos
Riscos:
- Jornada 3 sem suporte no Inter (plano B).
- Limite do pagador abaixo da mensalidade.
- Autorização cancelada no banco.
- Perder o prazo de 2 dias (rotina com margem e alerta).
- Avisos do banco com nomes diferentes (já tratado no webhook).
- A integração antiga, com credenciais perdidas, não pode ser usada.

Aprovações do dono:
1. Teste real de R$ 1 da jornada 3.
2. Plano A ou B.
3. Taxa de R$ 24,90.
4. Texto do §6–§8.
5. Ordem de liberação.
6. Horário da rotina diária.

Testes:
- Vitest e Deno: escolha da forma, prazo de 2 dias, sem repetição, estados de autorização, ativação apenas com as duas confirmações.
- Ensaio de banco em transação desfeita.
- Tela no computador e no celular.
- Regressões: cartão, Pix à vista, 12x e balcão.

Ordem de entrega (cada etapa com aprovação):
- **P1** — Teste da jornada 3 (R$ 1).
- **P2** — Banco: vínculos e flags, com script de volta.
- **P3** — Função de criar QR, acompanhar e ativar.
- **P4** — Tela do checkout.
- **P5** — Rotina diária e conciliação.
- **P6** — Telas da equipe.
- **P7** — Versão nova do contrato, junto com o §5 do Plano 1.
- **P8** — Liberação do Start.

Estimativa: P1 ~2, P2 ~3, P3 ~5–7, P4 ~4–5, P5 ~5–6, P6 ~3–4, P7 ~2, P8 ~1. Total ~25–30 créditos.
