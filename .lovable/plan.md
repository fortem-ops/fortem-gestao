# Fase 3F — Pix Automático por QR Code (caminho B)

Nada é executado antes do OK do dono. Cobrança máxima: R$ 1,00. Nada é apagado. Cron do cartão segue desligado.

## 1) Qual jornada usar

O Banco Central define quatro formas de o aluno autorizar o Pix Automático. As que usam QR Code são:

| Jornada | O que o QR faz | Cobra no ato? |
|---|---|---|
| 2 | Só autoriza a recorrência | Não. A primeira cobrança sai depois, pelo ciclo |
| 3 | Paga a primeira mensalidade e autoriza as próximas (QR composto: cobrança imediata + recorrência) | Sim, cobra o valor da cobrança imediata |
| 4 | Igual à 3, mas a primeira cobrança é com vencimento | Sim, na data de vencimento |

**Recomendação para o teste de R$ 1,00: Jornada 2 (só autoriza).**
- É a mais simples: não precisa de cobrança imediata, nem de vincular um txid, nem de dar baixa.
- O dono lê o QR, vê "Teste Pix Automatico FORTEM", R$ 1,00 mensal de 14/10 a 14/11, e autoriza. Nesse momento não sai nenhum dinheiro.
- O R$ 1,00 só é cobrado na parte B do teste (cobr), depois do seu OK com o status AUTORIZADA.

**Para o produto (/planos, mensal com valor fixo): Jornada 3.** O aluno paga a primeira mensalidade e autoriza as próximas com um único QR, como em um checkout comum. Ela fica para uma etapa futura e não entra neste teste.

## 2) A recorrência já criada pode ser reaproveitada?

- Ela está como CRIADA (idRec `RR0041696820261013GHAjHW1tmv3`), sem location e sem solicitação válida.
- Pela especificação do Banco Central, uma recorrência CRIADA aceita revisão (PATCH /rec/{idRec}) para incluir `loc`. **Isso não está confirmado para o Inter.** A documentação pública do Inter não deixa claro.
- Plano em duas etapas, sem loop:
  - **A (preferida):** criar o location e tentar vincular à recorrência existente uma única vez. Se o Inter aceitar, ela é reaproveitada e nada é recriado.
  - **B (se o vínculo for recusado):** só com o seu OK, cancelar a recorrência atual com o motivo "teste 3F" (o registro continua no banco como CANCELADA) e criar uma nova já com o `loc`.
- **Datas, se for recriar:** a data de início precisa ser futura e, em geral, no mínimo D+1. Sugestão: início em **15/10/2026** e fim em **15/11/2026**, ou o dia seguinte ao do teste. Uma nova recorrência de teste exige liberar a trava do modo de teste, que hoje recusa quando o aluno já tem recorrência. A liberação aceita apenas o caso "existente CANCELADA com marca teste_3F".

## 3) Endpoints, campos e QR

```text
1. POST /pix/v2/locrec                      -> { id (locrec), location, ... }
2a. PATCH /pix/v2/rec/{idRec}  { "loc": <id locrec> }     (reaproveitar)
2b. POST  /pix/v2/rec  { vinculo, calendario, valor, politicaRetentativa, "loc": <id> }  (recriar)
3. GET /pix/v2/rec/{idRec}                  -> traz o QR/copia-e-cola da jornada 2
   (campo esperado: dadosQR.pixCopiaECola / dadosQR.jornada; nome exato a confirmar na 1ª resposta)
```
- Os dados da recorrência continuam iguais aos da criada: vinculo.objeto "Teste Pix Automatico FORTEM", devedor com o CPF de NICOLAS TESTE (mascarado nos relatórios), MENSAL, valorMinimoRecebedor "1.00", PERMITE_3R_7D.
- O "copia e cola" vai para você em texto e também como imagem de QR gerada no sistema (sem serviço externo). Você mostra ao dono.
- **No app do banco:** Pix > Ler QR Code (ou Pix Copia e Cola). Aparece a tela de **autorização do Pix Automático**, com recebedor, valor, periodicidade e período, e o dono toca em Autorizar. Na Jornada 2, **não sai nenhum valor**.

## 4) Avisos (webhooks) esperados

- **Recorrência:** status AUTORIZADA (ou REJEITADA/CANCELADA). O pix-webhook já trata essas três situações e atualiza `pix_recorrencias.status`. Os avisos de recorrência e cobrança já estão cadastrados no Inter com o token.
- **Parte B futura (cobr):** COBR_AGENDADA, COBR_LIQUIDADA, COBR_REJEITADA, COBR_CANCELADA. O pix-webhook já trata todas, procurando em `pix_cobrancas` pelo txid.
- **Jornada 3, futura:** a primeira mensalidade chega como um Pix comum (pelo txid da cobrança imediata). Hoje, um txid que não está em `pix_cobrancas` é apenas registrado e ignorado. A jornada 3 vai exigir gravar essa cobrança imediata antes de mostrar o QR.
- **Conferência manual:** depois que o dono autorizar, faço também um GET /rec/{idRec} (só leitura) para confirmar o status, caso o aviso demore.

## 5) Efeito no produto (/planos) — etapa futura, não executada agora

- Na etapa de pagamento, quem escolher Pix recorrente veria o QR e o botão "Copiar código Pix". O aviso diria que ao pagar a primeira mensalidade o aluno autoriza as próximas, sem pedir conta nem banco.
- Status ao vivo na tela (aguardando, autorizado), atualizado pelos avisos.
- Exige: recorrência e cobrança imediata criadas no servidor no fim da proposta, baixa da primeira mensalidade e textos centralizados. Pix Automático continua fora da página até um go-live próprio.

## 6) Riscos e reversão

- **PATCH com `loc` recusado pelo Inter:** paro e peço o seu OK para cancelar e recriar.
- **QR exibido sem recorrência válida:** ao autorizar, o banco mostraria erro, sem nenhum valor envolvido.
- **Autorização concedida:** reversível. A recorrência pode ser cancelada (motivo "teste 3F") pelo Inter ou pelo próprio dono no app. Nenhum dado é apagado.
- **Cobrança:** a Jornada 2 não gera nenhuma. A cobr de R$ 1,00 fica só para a parte B, com OK separado.
- **Limite do Inter:** uma chamada por etapa, sem repetição automática. Os tokens ficam em cache.
- **Alterações no sistema:** um modo interno e temporário, com parâmetros fixos, igual ao teste_3f_criar, registrado em system_logs. As funções admin continuam só para admin. Loja/Corrida, Pix comum e crons ficam inalterados.

## Execução após o OK

1. Modo interno `teste_3f_qr` (confirmação "TESTE_3F_QR"): POST /locrec, depois PATCH /rec com `loc` (uma vez), depois GET /rec, devolvendo o status HTTP de cada chamada, o idRec e o copia e cola, com erros brutos e CPF mascarado.
2. Gravar o loc e o copia e cola no registro de teste (dentro de raw_response, sem migração).
3. Entregar o QR ao dono e aguardar a autorização.
4. Confirmar AUTORIZADA pelo aviso e pelo GET. Depois disso, parar e aguardar o OK para a parte B (cobr de R$ 1,00).

## Perguntas em aberto

1. Para o teste, você confirma a Jornada 2 (só autoriza, sem cobrar no ato)? Ou prefere já a Jornada 3, que cobra R$ 1,00 na leitura do QR e exige gravar uma cobrança imediata?
2. Se o Inter recusar o vínculo do `loc` na recorrência existente, já está autorizado cancelar ("teste 3F") e recriar com início em 15/10/2026 e fim em 15/11/2026? Ou prefere que eu pare e pergunte?
3. O pedido de confirmação que falhou (solicrec) não deixou nenhum registro no Inter. Posso ignorá-lo?
