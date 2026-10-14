# Recorrência no cartão + Start no /planos (rodada única, em fases)

Estado conferido: cron `cobrar-recorrencias-diario` está **inativo**; `renovar-planos-mensais-daily` (03:00) e `processar-cobrancas-diario` (07:00) seguem ativos. O núcleo `_shared/rede-recorrencia-core.ts` (`cobrarComToken`) já faz criptograma `subscription:true` + transação MIT `storageCard:"2"`. O cartão do /planos hoje usa `subscription:false` (compra única).

## 1. Fluxo do comprador

```text
Cadastro → Revisão → Contrato (recorrência) → Pagamento (cartão) → Confirmação
                                              |
             tokeniza (storageCard 2, zero-dollar) — mesma tela de hoje
             1ª mensalidade cobrada NA HORA (CIT, subscription:true)
             aprovada → cria cronograma de mensalidades
```

- **Tokenização**: a mesma de hoje (`rede_tokenizacoes` com `proposta_id`), sem guardar número/CVV.
- **1ª mensalidade cobrada na hora** (recomendado), pois vence na data da venda. É a transação iniciada pelo titular, com CVV presente na tokenização. As seguintes são cobranças sem o titular (MIT) pelo `cobrarComToken`.
- **Após aprovar**:
  - **Power/Pro recorrência**: cria as 12 mensalidades de uma vez (1ª paga, 11 pendentes com vencimento mensal no mesmo dia; meses curtos no último dia). Créditos do plano inteiro liberados na venda.
  - **Start**: cria só o ciclo atual (pago) e o próximo pendente; cada pagamento gera o ciclo seguinte (`fn_renovar_start_2027`).
- **Consultas junto do plano em recorrência**: pagamento separado, no mesmo passo, depois da 1ª mensalidade: cartão até 6x ou Pix à vista (reutiliza o fluxo atual).
- **Tela de confirmação / e-mail**: "Assinatura ativa. 1ª mensalidade de R$ X paga hoje. Próximas cobranças automáticas todo dia D no cartão final NNNN". Power/Pro mostra "12 mensalidades"; Start mostra "renova mensalmente, cancele quando quiser". O e-mail usa o mesmo `planos-confirmacao` com um bloco novo para a recorrência.
- **3 recusas em 30 min**: a proposta fica "aguardando". A tela oferece Pix à vista (só Power/Pro, valor do Pix) ou contato com a equipe; Start oferece só contato. O aviso interno é o atual de recusa.

## 2. Cobrança mensal automática (só 2027)

- **Função nova** `planos-recorrencia-diario`, com cron próprio novo. O `cobrar-recorrencias-diario` antigo **não é religado nem editado**.
- **Escopo fixado no banco**: uma RPC `fn_recorrencia_2027_devidas()` (service_role) devolve só cobranças que cumprem tudo isto:
  - têm vínculo `origem='planos_2027'`;
  - têm `contratos.catalogo_id` com `versao` não nula;
  - têm token ligado à proposta.
  Gatilho de banco: uma cobrança com `origem='planos_2027'` só aceita token cuja proposta seja a mesma. Nada antigo entra, nem por erro na função.
- **Flag** `planos_recorrencia_ativa` (desligada) e o mesmo `planos_pagamento_modo_teste`/teto R$1,00.
- **Retentativas**: no D0, D+1 e D+3 (3 tentativas). Depois a mensalidade fica "inadimplente", com um aviso interno à equipe (comercial/alta, sem CPF) e WhatsApp/e-mail ao aluno somente se você aprovar (pergunta 4).
- **Start em falha**: crédito mensal só sai com a mensalidade paga, com tolerância de 3 dias (`fn_creditos_mensais_2027` passa a checar o pagamento do ciclo). Sem pagamento até D+3, não libera crédito do ciclo e não gera o próximo. O acesso vai até o fim do último ciclo pago. Se pagar depois (Pix/cartão manual), libera e retoma.
- **Power/Pro em falha**: os créditos já foram liberados. Fica inadimplência normal, sem bloquear créditos (pergunta 5).

## 3. Start na tela

- **Passo 5, variante só recorrência**: sem escolha de forma, texto "Pagamento mensal automático no cartão de crédito. Sem fidelidade: cancele quando quiser; o acesso vale até o fim do mês pago." Sem Pix nem parcelado.
- **Cálculo**: `calcularVenda2027` ganha o caso Start = 1 parcela mensal (valor do catálogo), total exibido "R$ X/mês", sem total anual.
- **Contrato**: template `familia=start` + `cartao_recorrencia` (de `contrato_templates`), com variáveis de ciclo indefinido, sem multa e cancelamento a qualquer tempo. Se o template não existir, a ativação recusa (regra atual).
- **Renovação indefinida**: ciclo a ciclo até um cancelamento registrado (botão admin "Cancelar assinatura": marca o fim no ciclo atual e não cria o próximo).

## 4. Segurança

- **Idempotência por ciclo**:
  - índice único (`contrato_id`, `competencia`) nas mensalidades 2027;
  - trava atômica (`fn_recorrencia_2027_reservar`) antes de cobrar;
  - referência Rede determinística por cobrança + tentativa;
  - resultado incerto vira `desconhecido`, conferido pela referência e nunca recobrado.
- **Limites**: no máximo 1 cobrança aprovada por cobrança/ciclo e 3 tentativas por ciclo. Valor sempre lido da cobrança no banco, nunca do navegador. Teto global por execução (ex.: 50 cobranças) com alerta se excedido.
- **Testes**: modo `simulacao` (resultado escolhido pelo admin, nada vai à Rede) para toda a jornada, inclusive "pular para o próximo mês". O modo real só funciona com `real_baixo_valor`, teto R$1,00 e proposta de teste. Ele volta à simulação após um uso, como hoje.
- **Sem dados sensíveis**: nada de PAN/CVV/CPF em logs; nome do titular só no token, apagado ao encerrar.

## 5. Fases (cada uma para aprovação)

| Fase | Entrega | Verificação SQL |
|---|---|---|
| R1 Banco | colunas de origem/competência, índice único, RPCs devidas/reservar/resultado, gatilho de escopo, flag desligada | `fn_recorrencia_2027_devidas()` retorna 0 linhas; inserir cobrança antiga com origem 2027 falha; tudo em transação desfeita |
| R2 Cálculo + Start | `calcularVenda2027` Start, variante do passo 5, template, textos | Start: 1 parcela = preço catálogo; Power 2x recorr. = 12 × e total R$ 453,90 |
| R3 1ª mensalidade | CIT `subscription:true` no fluxo de proposta, criação do cronograma (12 / ciclo Start) | simulação: 12 linhas Power, 2 linhas Start, 0 em `pagamentos_rede` |
| R4 Cobrança mensal | `planos-recorrencia-diario` (simulação), retentativas, avisos, crédito Start condicionado | rodar 2x a mesma data → 1 tentativa por ciclo; Start não pago D+3 → 0 crédito |
| R5 Teste real R$1 | só com seu pedido: 1ª mensalidade R$1 + 1 MIT R$1 com NICOLAS TESTE | 2 linhas aprovadas, nenhuma duplicada |
| R6 Liberação | ligar flag + cron novo, só com seu pedido | cron antigo segue `active=false` |

## Perguntas ao dono (com recomendação)

1. 1ª mensalidade cobrada na hora? **Sim** (vence na data da venda).
2. Datas de retentativa: **D0, D+1, D+3**?
3. Vencimento em mês sem o dia (29–31): **último dia do mês**?
4. Avisar o aluno na recusa por WhatsApp/e-mail? **Só aviso interno nesta rodada.**
5. Power/Pro inadimplente: créditos continuam? **Sim, só cobrança pela equipe.**
6. Cancelamento do Start: só pela equipe (botão admin) nesta rodada? **Sim.**
7. Horário do cron novo: **05:00**, depois da renovação das 03:00?
8. Troca de cartão após recusa: link para nova tokenização? **Fica para a próxima rodada; equipe resolve.**

## Riscos

- O emissor pode recusar MIT sem CIT anterior com `subscription:true`; por isso a 1ª cobrança vira CIT com `subscription:true`. Validar no teste R5.
- O código 107 já apareceu antes; manter `motivo` detalhado.
- Mexer em `fn_creditos_mensais_2027` afeta créditos do Pro: a mudança fica restrita ao Start.
- Tokens podem expirar (validade 2029+); o aviso interno cobre isso.

## Fora do escopo

Pix Automático, boleto, ativação automática do aluno/contrato, religar ou editar `cobrar-recorrencias-diario`, Loja/Corrida/rede-*, troca de cartão pelo aluno, estornos.

## Detalhes técnicos

- Reaproveitar `cobrarComToken` importando de `_shared` sem editá-lo. A CIT do /planos ganha um parâmetro `subscription` em `cartao-rede.ts` (padrão false, inalterado para 1x–12x).
- Mensalidades em `cobrancas` com `origem='planos_2027'`, `competencia`, `contrato_id` (do contrato criado na ativação manual atual). Enquanto o contrato não existe, as mensalidades ficam ligadas à proposta (`proposta_id`) e são vinculadas na ativação.
- Idempotência: `UNIQUE (proposta_id, competencia) WHERE origem='planos_2027'`.
