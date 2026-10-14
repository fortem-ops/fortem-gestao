# Consultas pagas separadamente com plano em recorrência — somente planejamento

## Regras a preservar
- Start, Power e Pro no cartão recorrente: consultas em um segundo pagamento, cartão de 1 a 6x ou Pix à vista, sem desconto.
- Plano parcelado em até 12x: consultas continuam junto nas mesmas parcelas, sem alteração desse fluxo.
- Consultas vendidas liberam todos os créditos, válidos por 12 meses; cancelar o plano não elimina esses créditos nem as parcelas das consultas, inclusive as 12x do fluxo combinado.
- Estorno não retira plano/créditos automaticamente; retirada manual pela equipe, como no balcão.
- Consultas nunca entram no cron de recorrência. Nenhuma cobrança, estorno, envio de e-mail, alteração de chaves/cron ou publicação nesta etapa.

## Estado atual confirmado por leitura de código e banco
- Checkout público, cartão real (escopo todos), recorrência e e-mail de confirmação estão ativos. Não há vendas com origem site_2027/teste_2027; existem três propostas pagas e nenhuma ativada. Isso não significa inexistência de vendas legadas.
- O cálculo já separa valor/forma/parcelas de consultas. Porém `fn_checkout_2027_pagamento_iniciar` e `fn_checkout_2027_recorrencia_real` recusam recorrência com consultas. Portanto o bloqueio não é só visual.
- `checkout_2027_tentativas` possui tipo Pix/cartão e indicador de recorrência, mas não possui finalidade plano/consultas. Início e aprovação consideram a proposta inteira: uma aprovação impede novo pagamento.
- A ativação atual passa todas as consultas à venda e marca suas vendas pagas; o miolo cria seus créditos imediatamente. Em recorrência, `p_sem_cobrancas` pula também as cobranças separadas dos serviços. Simplesmente remover o bloqueio geraria créditos/registro pago sem pagamento das consultas.
- A baixa Pix atual marca a proposta paga e seu pagamento como Pix. Não pode receber o Pix das consultas sem distinguir a finalidade.
- A Fase E usa a última tentativa aprovada da proposta e créditos associados ao plano; precisará selecionar explicitamente os dois pagamentos e incluir os créditos das vendas de consultas.
- Os cinco serviços 2027 ativos incluem avaliação corporal avulsa; o cálculo público atual aceita apenas os quatro pacotes de nutri/fisio. Incluir a avulsa exige decisão de escopo.

## 1. Fluxo recomendado na tela
Manter duas áreas claras no passo de pagamento e no resumo antes do aceite:

```text
PLANO
R$ A por mês no cartão · primeira mensalidade hoje
Start: renovação mensal / Power e Pro: 12 mensalidades

CONSULTAS
Pacotes, quantidades e total R$ B
Cartão: escolher 1 a 6x · ou Pix à vista R$ B, sem desconto
Créditos válidos por 12 meses, independentes do cancelamento do plano
```

**Ordem: plano primeiro, consultas depois, na mesma sessão quando possível; sempre duas transações.** Nunca somar consultas à primeira mensalidade. Autorizar e cobrar cada parte com valor explícito. Pix só é gerado depois da aprovação do plano. Para cartão, o segundo comando mostra “Pagar consultas — N x R$ B/N”; não cobrar silenciosamente após aprovar o plano.

| Situação | Resultado recomendado |
|---|---|
| Primeira mensalidade recusada | Não cobrar consultas; nada ativado. Nova tentativa apenas do plano. |
| Plano aprovado, consultas pendentes/recusadas | Ativar plano e seus créditos; mostrar “Plano ativo — pagamento das consultas pendente”. Não criar venda/créditos de consultas ainda. Permitir retomar apenas consultas. |
| Ambos aprovados | Plano ativo e consultas vendidas/créditos liberados; dois comprovantes identificados. |
| Resultado do plano desconhecido | Não iniciar consultas, não recobrar plano; conciliar referência. |
| Resultado das consultas desconhecido | Plano continua ativo; bloquear nova cobrança e troca para Pix/cartão até esclarecer. |
| Dinheiro confirmado, falha na ativação | Preservar baixa, registrar aviso e permitir ativação/reprocessamento idempotente, sem recobrar. |

Fechar/reabrir a página reconstrói os dois estados no servidor. Uma compra parcialmente concluída não é “falha total”. Depois de aprovar o plano, bloquear alterações do plano/aceite já pago; eventual mudança de forma/parcelas das consultas exige novo aceite específico, preservando o original.

## 2. Venda, contrato e créditos
**Recomendação para aprovação:** no site, vender as consultas somente quando o seu pagamento for confirmado; liberar créditos nessa mesma venda, sem esperar quitar as parcelas na fatura do cartão. Isso mantém “crédito na venda”, mas evita consultas grátis quando o segundo pagamento recusa.

- Aprovação da primeira mensalidade ativa somente o plano; Start mantém regras mensais, Power/Pro mantêm regras atuais.
- Aprovação do cartão das consultas confirma o total financiado de uma vez; criar venda e todos os créditos nesse instante. Pix libera após baixa validada. Validade: 12 meses da venda das consultas, não da compra anterior do plano.
- Documento aceito descreve obrigações independentes, condições de liberação, duas formas de pagamento e sobrevivência das consultas ao cancelamento. Snapshot/hash original nunca reescrito. Separar status financeiro de cada obrigação do estado jurídico do aceite.
- Cancelamento do plano interrompe apenas mensalidades do plano. Consultas pagas continuam utilizáveis; suas parcelas permanecem registradas. No combinado 12x, proteger a composição das parcelas para não apagar a parte de consultas ao cancelar o treino.
- Após cancelamento, cobrança nova de consultas ainda pendentes ficará bloqueada por padrão até decisão do dono; pagamento já liquidado ou tardio não pode ser descartado.

## 3. Modelo técnico proposto
**Reusar tentativas, com uma obrigação separada por finalidade.**
- Criar registro interno `planos_2027_pagamentos_avulsos` (nome proposto) para a obrigação agregada das consultas: proposta, aceite específico, itens/preços congelados, total em centavos, forma, parcelas, status, tentativa aprovada, baixa, ativação e vínculos das vendas. Não criar outra tabela de mensalidades nem guardar PAN/CVV.
- Acrescentar finalidade às tentativas: `plano`, `consultas`, `combinado`. Vincular consultas à obrigação avulsa; registros antigos recebem interpretação compatível, sem recriar vendas/propostas históricas.
- Reservas/travas/referências distintas por obrigação e tentativa; uma aprovação do plano não bloqueia consultas, e consultas nunca substituem `pago_em`, TID ou cartão da assinatura.
- Valores, catálogo, limite 6x, ausência de desconto, elegibilidade e escopo real/teste recalculados/validados no servidor. Garantir comparação de forma/parcelas/itens de consultas contra o aceite, não só total do plano.
- Extrair/reusar o miolo de venda de serviços com chamada interna service-only, preservando o comportamento de balcão. Chave única por obrigação/item impede dupla venda e duplo crédito.
- Cartão consultas: uma transação Rede pelo total, espelho em `pagamentos_rede` ligado à obrigação; 1 a 6 linhas em `cobrancas`/parcelas pelos padrões atuais, mesmo TID, valores em centavos e sobra na última. Vencimentos mensais desde a venda, dia 29–31 ajustado ao último dia; baixa registrada como o cartão parcelado atual. Não são novas cobranças mensais na Rede.
- Pix: uma cobrança financeira paga. Composição vincula cada consulta/venda para receita e estorno sem duplicar totais. Identificação explícita impede cancelamento do plano/rotinas legadas de apagar essas linhas.
- Novas tabelas com GRANT restrito, RLS e RPCs com search_path fixo; consulta coord/admin conforme Financeiro, ações financeiras sensíveis só admin no servidor. Sem comissão nova; origem de teste continua fora dos relatórios reais.

## 4. Cartão, consentimento e PCI
**MVP recomendado: duas autorizações/tokenizações separadas**, permitindo o mesmo cartão digitado novamente ou outro cartão. Recorrência usa seu token permanente; consultas usam captura/tokenização de compra avulsa. Mais fricção, porém reduz o risco de tratar consultas como mensalidade autorizada anteriormente.

Reuso do token da assinatura é tecnicamente plausível: o fluxo gera criptograma por transação. Não é autorização para uma compra nova. Oferecer “Usar cartão final NNNN para consultas” somente após conferir a documentação/condições Rede aplicáveis à integração, classificação de compra iniciada pelo cliente (CIT), parcelamento e eventual autenticação exigida. Novo consentimento explícito com total/parcelas, novo criptograma e referência; nunca reutilizar criptograma nem chamar o núcleo MIT de recorrência sem adaptação aprovada. Não prometer dispensa de CVV/3DS sem confirmação do provedor.

- Fonte oficial a validar na F3: manual e.Rede, seções tokenização/card-on-file: https://developer.userede.com.br/files/traducoes/erede/e-rede_14082026.pdf e https://developer.userede.com.br/e-rede . Confiança alta na necessidade de autorização separada; compatibilidade exata deste token/conta ainda não comprovada sem validação específica.
- Usar validade `token_expiration`, fallback já existente; campos apagados após envio, nunca em storage/log/URL. Nome do titular das consultas expurgado após conclusão; não apagar o necessário à assinatura ativa. Token avulso não habilita recorrência.
- Descritores propostos “FORTEM PLANO” / “FORTEM CONSULTAS”, sujeitos ao limite e configuração Rede; manter descritor atual da assinatura até aprovação, sem alterar adquirente.
- Recusa de consultas: retry manual com limite; resultado desconhecido exige consulta por referência. Sem D0/D+1/D+3, sem cron e sem retry silencioso de cobrança.

## 5. Pix separado e estorno
- Plano recorrente continua exclusivamente no cartão; consultas recebem Pix próprio, txid e tentativa ligados à obrigação de consultas. Nunca reutilizar Pix de plano/Loja/Corrida.
- Reusar `pix_cobrancas` com vínculo inequívoco à obrigação/tentativa. Expiração proposta: 30 minutos, reaproveitamento só da própria tentativa ativa com margem já usada de 1 minuto.
- Classificar no caminho de planos do webhook existente e baixar somente consultas; não converter assinatura para Pix nem executar novamente ativação do plano. Duplicação webhook/polling retorna já processado; conferir total, txid e identificação do pagamento.
- Baixa tardia do Pix expirado continua reconhecida. Após cobrança substituta, se os dois Pix forem pagos, liberar crédito/venda uma vez e alertar pagamento excedente; nenhuma devolução automática.
- Fase C: reaproveitar saldo/reserva/confirmação de estorno por cobrança/obrigação, sem atingir mensalidade nem outro TID. Pix permanece devolução total e admin-only, nunca real em testes. Estorno parcial de parcela Rede mantém o risco conhecido de aceitação pelo provedor; comprovação real fica para autorização separada.

## 6. E-mail e operação
**Recomendação: dois e-mails distintos nesta combinação**, porque Pix/recusa pode separar os pagamentos por horas ou dias:
1. Após ativação do plano: comprovante da primeira mensalidade + contrato aceito, calendário/cartão da assinatura e consultas claramente pendentes quando for o caso.
2. Após venda/ativação das consultas: comprovante das consultas, forma/parcelas, créditos e validade, referência ao mesmo contrato/aceite ou aditivo específico.

Cada evento tem reserva/chave própria e reenvio admin; pagamentos já enviados não são reemitidos automaticamente. Remetente, Resend, chave atual e trava NICOLAS TESTE mantidos. Nenhum e-mail das mensalidades posteriores. Falha de envio nunca desfaz baixa/venda. Financeiro mostra plano e consultas separadamente, incluindo ativação parcial e estorno pelo caminho atual.

## 7. Fases e validações sem dinheiro real
- **F1 — dados/regras:** snapshot inicial, RPCs/reservas/finalidades, estados, termo e regra de liberação aprovada; ensaios SQL rollback. Nenhuma liberação pública.
- **F2 — tela:** dois resumos, autorização explícita, estados parciais, retomada e simulação; desktop/móvel. Fluxo combinado 12x e sem consultas intactos.
- **F3 — cartão:** nova compra avulsa tokenizada, CIT/consentimento confirmados, classificação explícita e conciliação desconhecida; provedor simulado, nenhuma chamada financeira real.
- **F4 — Pix:** vínculo/expiração/roteamento webhook/conciliação e duplicidade; mocks e rollback, sem gerar Pix real.
- **F5 — integração:** ativação independente, créditos, espelhos/relatórios, cancelamento, estorno e dois e-mails; ensaio completo no NICOLAS TESTE com mocks, sem envio real nesta nova fase. Publicação/liberação pública somente por autorização específica após relatório.

Cobrir Start/Power/Pro × cartão 1x/3x/6x/Pix; ambos aprovados, recusa de cada lado, desconhecido, falha pós-baixa, retorno/reload, clique concorrente, webhook duplicado e tardio, pagamento duplicado, fim de mês, sobra em centavos, RLS/roles, teste bloqueando valor real, cancelamento antes/depois, validade 12m, permanência das consultas e parcelas 12x. Assertivas de banco: um plano, uma venda por item, um crédito por composição, nenhum espelho ou e-mail duplicado, cron só mensalidades do plano. Regressões de balcão, 12x combinado, Pix do plano, estorno e Fase E obrigatórias.

## Riscos e limites
Principal risco: uma baixa global marcar a outra obrigação paga/liberar créditos. Outros: dupla cobrança em resultado incerto; consulta Pix cancelando/mudando assinatura; receita somada duas vezes; cancelamento apagando parcelas; documento/e-mail sugerindo quitação total quando parcial. Por isso não basta desbloquear tela ou somar os totais.

Achado adicional de segurança: a definição atual de `fn_recorrencia_2027_cancelar` aceita coordenador ou admin, embora a decisão anterior restrinja cancelar assinatura a admin. Sem alteração nesta etapa; decidir autorização de alinhamento servidor/tela antes da implementação.

Nenhuma mudança proposta em Loja, Corrida, rede-*, cron antigo ou suas integrações. Não alterar chaves/crons atuais durante as fases; definir liberação específica da nova combinação posteriormente. Nenhum teste financeiro real implícito na aprovação deste plano.

## Decisões do dono necessárias
1. Aprovar plano primeiro, ativação independente e consultas vendidas/créditos liberados somente após seu pagamento? Recomendação: sim.
2. Duas capturas no MVP (mesmo cartão ou outro), ou investir no reuso com consentimento e validação Rede antes da estreia? Recomendação: duas capturas; reuso em etapa posterior.
3. Aprovar dois e-mails claramente distintos nessa combinação? Recomendação: sim, sem esperar Pix para enviar o contrato/plano ativo.
4. Quanto tempo manter consultas pendentes para retomada e o que fazer após cancelar o plano? Proposta: 7 dias, mantendo preço/aceite congelados; depois novo aceite para consultas, sem mexer no plano pago. Prazo proposto requer adequar a expiração atual da sessão e links de retomada seguros. Não vender consultas pendentes após cancelamento sem novo consentimento.
5. “Demais serviços” inclui agora avaliação corporal avulsa ou apenas os quatro pacotes já oferecidos? Recomendação: lançar primeiro os atuais, incluir a avulsa após aprovação editorial/comercial.
6. Autorizar o alinhamento de cancelamento só admin no servidor, corrigindo a divergência encontrada? Recomendação: sim, em alteração delimitada e testada.
