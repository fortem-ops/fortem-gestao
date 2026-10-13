# Cartão de crédito real (Rede, tokenizado, 1x a 12x) no checkout público /planos

Troca o "cartão a combinar" por cobrança real no cartão, sempre com o cartão tokenizado pela Rede, no mesmo modelo da Loja e da Corrida. Recorrência continua reservada. Nada é cobrado de verdade sem pedido explícito do dono.

## Estado atual (conferido)

- `planos-checkout`: fora da simulação, `pagar_cartao` grava a tentativa como `recusado/cartao_real_nao_liberado` e a tela mostra "a combinar".
- `rede_tokenizacoes`: já tem `proposta_id`, mas `aluno_id` é NOT NULL.
- `cartoes_salvos`: `aluno_id` é NOT NULL e não há coluna `proposta_id`.
- `pagamentos_rede`: já tem `proposta_id` e `idempotency_key`.
- `rede-salvar-cartao` grava `aluno_id` e a auditoria em `system_logs`, com payload que inclui last4.
- `rede-tokenizacao-webhook` hoje:
  - grava `raw_response` com a consulta completa em `system_logs` e em `rede_tokenizacoes`;
  - quando o token fica ativo, cria `cartoes_salvos` pelo `aluno_id` e vincula contratos de recorrência desse aluno.
- Soft descriptor: nenhuma função atual envia esse campo à Rede.

## Fluxo escolhido: Opção A, tokenização

```text
Tela (passo 8)            planos-checkout                        Rede
cartão + parcelas ──► acao tokenizar_cartao
                       reserva tentativa (lock, limites)
                       POST tokenização (número só em memória) ──► token Pending
                       grava rede_tokenizacoes(proposta_id, aluno_id NULL,
                                               origem='planos', last4, bandeira)
polling 8 s ◄───────── acao status_cartao
                      rede-tokenizacao-webhook (desvio por origem='planos')
                       Active  -> marca token ativo (sem cartoes_salvos)
                       Recusa  -> marca recusado
status_cartao vê Active ──► criptograma + transação (cobrarComToken) ──► aprovado/negado
                       aprovado -> fn_checkout_2027_cartao_liquidado + pós-pagamento + e-mail
```

### Reutilizado sem mudança
- `_shared/rede-auth.ts`, `_shared/rede-payload.ts`, `_shared/rede-brand-token.ts`
- `_shared/rede-recorrencia-core.ts` (`cobrarComToken`)
- `_shared/pagamento-motivo.ts`, `_shared/avisar-recusa.ts`
- `fn_checkout_2027_pagamento_iniciar`, `fn_checkout_2027_pos_pagamento`, `planos-confirmacao`

### Novo
- `supabase/functions/_shared/rede-tokenizar.ts`: extrai de `rede-salvar-cartao` só a chamada de tokenização (validação Luhn, bandeira, requisição) como função pura e reutilizável. `rede-salvar-cartao` não muda: continua com o código dele, e a extração é cópia, para não arriscar Loja e Corrida.
- `supabase/functions/planos-checkout/cartao.ts`: funções puras.
  - Opções de parcelas vindas do servidor.
  - Chave de idempotência.
  - Mapeamento do retorno da Rede: `aprovado | recusado | desconhecido`.
  - Mapeamento do status do token: `pendente | ativo | recusado | expirado`.
  - Máscara do TID.
  - `sanitizarRaw()`, que mantém só status, returnCode, bandeira e last4.
- `supabase/functions/planos-checkout/cartao-rede.ts`: tokenizar, consultar token, cobrar e consultar transação por referência.
- `supabase/functions/rede-tokenizacao-webhook/planos-token.ts`: tratamento separado para tokens com `proposta_id`.

### Alterado (mudança mínima)
- `planos-checkout/index.ts`:
  - novas ações `tokenizar_cartao` e `status_cartao`;
  - `pagar_cartao` passa a chamar `tokenizar_cartao`;
  - `cartao_combinar` só vale para recorrência ou com a flag desligada.
- `rede-tokenizacao-webhook/index.ts`: um desvio no início. Se o registro tem `proposta_id` e `aluno_id` nulo, chama `planos-token.ts` e retorna, sem `cartoes_salvos`, sem contratos e sem `system_logs` com o raw. Os registros com `aluno_id` seguem pelo caminho atual, byte a byte.
- `PagamentoReservado2027.tsx`, `planosPublicoTextos.ts`, `planos-checkout/AGENTS.md`.

Não muda: `rede-salvar-cartao`, `loja-cobrar-pedido`, `corrida-cobrar-pedido`, `rede-cobrar-*`, `rede-webhook`, Pix e `pix-webhook`, Pix Automático, catálogo, cron e dados de alunos.

### Token da proposta sem aluno
- Não cria linha em `cartoes_salvos`. Por isso essa tabela fica sem alteração e nada muda para quem já usa.
- O token, o `token_code` e a validade ficam só em `rede_tokenizacoes`, que não tem acesso anônimo.
- A cobrança lê `rede_tokenizacoes` por (`proposta_id`, `id` da tentativa, `status='active'`). Usa `tokenization_id` para o criptograma e `token_code` + validade como `cardNumber`, igual ao que a Loja faz com `cartoes_salvos.token_rede`.
- O nome do titular vai só para a Rede na hora da tokenização. Depois disso não é gravado em lugar nenhum; o campo `cardholder_name` fica nulo nos tokens de proposta.
- Se a Rede exigir nome e validade na transação, a validade é guardada em `token_expiration`, que já existe. O nome não é guardado: a cobrança acontece logo depois da ativação e o nome fica só na memória do servidor por, no máximo, 10 min, guardado em `checkout_2027_tentativas`. Isso não é possível sem gravar. Ver a pergunta Q1.

## Estados na tela

| Situação | Tela | Tentativa |
|---|---|---|
| Enviado, aguardando a Rede | "Validando seu cartão…" (polling a cada 8 s, botões travados) | `processando` / token `pendente` |
| Token ativado e cobrança em andamento | "Processando o pagamento…" | `processando` |
| Aprovado | Passo 9, "Pagamento confirmado" | `aprovado` |
| Recusado pela bandeira (token ou transação) | "Não foi possível usar este cartão" + "Tentar outro cartão" | `recusado` |
| Token não ativou em 10 min | "Não conseguimos validar o cartão a tempo" + "Tentar outro cartão" | `expirado` |
| Resultado desconhecido (timeout da Rede) | "Confirmando com o banco…" (polling) | `desconhecido`, sem recobrar |
| 3 tentativas esgotadas | "Pague por Pix ou fale com a equipe" | Proposta segue `aguardando_pagamento` |

- **Token ativo, mas a cobrança falhou:** a tentativa fica `recusado` e o token da proposta passa a `inativo`, porque nunca é reutilizado. Para tentar de novo, o cliente digita o cartão outra vez e um token novo é gerado. Isso conta como 1 das 3 tentativas.
- **Outro cartão:** cada nova tentativa sempre gera um token novo, e o anterior é marcado `inativo`.
- Voltar e Alterar ficam escondidos em `processando`, em `desconhecido` e depois do pagamento. "Modo simulação" aparece só na prévia admin.

## Regras de servidor (mantidas)

1. **Valor e parcelas** saem de `fn_checkout_2027_pagamento_iniciar` com a regra que já existe: plano até 12x, plano 12x + consultas juntos até 12x, consultas sozinhas até 6x conforme a regra atual. Sem parcela mínima. O front envia só o número de parcelas, que é validado contra a lista do servidor.
2. **Dados sensíveis.**
   - Número, CVV e nome do titular nunca vão para log nem para o banco.
   - O `raw_response` dos tokens de proposta passa por `sanitizarRaw` antes de qualquer gravação.
   - O desvio no webhook não grava a consulta completa em `system_logs`, só status, last4 e bandeira.
   - Nada de CPF.
   - Um teste automático procura padrões de cartão no que é gravado.
3. **Sem 3DS:** a responsabilidade por chargeback de fraude fica com o lojista. Mitigações: Turnstile, limites, contrato aceito e tokenização feita pela Rede.
4. **Limites:** 3 tentativas por proposta a cada 30 min, mais 10 por IP por hora (`ckcard:i:`). Mensagem neutra.
5. **Idempotência:**
   - Chave `proposta_id:aceite_id:n` em `pagamentos_rede.idempotency_key` e na `reference` da Rede (hash de 16 caracteres).
   - Índices únicos: uma tentativa `processando` por proposta e um `approved` por proposta.
   - Lock `FOR UPDATE` na proposta ao reservar a tentativa.
   - Proposta já paga: não se cobra de novo.
   - Timeout ou resultado desconhecido: não se cobra de novo. Consulta por referência no máximo a cada 30 s e conciliação; depois de 10 min sem transação encontrada, passa para recusado e a equipe é avisada.
   - A cobrança é disparada uma só vez por token ativo: a primeira ação `status_cartao` que encontrar o token ativo ganha o lock. As outras abas apenas aguardam o resultado.
6. **Aprovado:** `fn_checkout_2027_cartao_liquidado` faz o mesmo que a baixa do Pix:
   - marca a proposta `paga` com `pago_em`, `pagamento_tipo='cartao'`, `pagamento_ref` (TID), `pagamento_parcelas`, NSU e TID mascarado;
   - grava `pagamentos_rede.proposta_id`;
   - chama `fn_checkout_2027_pos_pagamento`, e depois o e-mail sai por `planos-confirmacao`.

   Não cria venda, aluno nem contrato.
7. **Recusado:** a proposta continua `aguardando_pagamento` e nunca vira `falhou`. Depois de 3 recusas, a tela oferece Pix ou contato com a equipe. Um aviso de recusa sai para a equipe, uma vez por proposta.
8. **Soft descriptor "FORTEM":** a eRede aceita `softDescriptor` de até 13 caracteres (ou 18, conforme a conta), e "FORTEM" cabe. É preciso ter a funcionalidade habilitada no cadastro do estabelecimento na Rede: se não estiver, a Rede devolve erro e a fatura mostra o nome padrão. Na F2 o campo vai atrás de uma configuração (`planos_cartao_soft_descriptor`, vazia = não envia). A confirmação de que a conta aceita só sai no teste da F4.

## Cenários de pagamento nesta rodada

| Cenário | Cobrado agora no site | Fica para a equipe | Etapa final |
|---|---|---|---|
| Plano 12x sozinho | Cartão em até 12x (total do servidor) ou Pix à vista | — | `paga` |
| Plano 12x + consultas | Tudo junto: cartão em até 12x ou Pix à vista | — | `paga` |
| Start (mensal) + consultas | Start é só recorrência mensal, então segue "a combinar" inteira | Tudo | `aguardando_pagamento` + aviso "a combinar" |
| Só consultas | Cartão até 6x (regra atual) ou Pix à vista | — | `paga` |
| Recorrência (Power/Pro +R$ 24,90) sozinha | Nada | Tudo | `aguardando_pagamento` + aviso "a combinar" |
| Recorrência + consultas | Nada (recomendado) | Tudo | `aguardando_pagamento` + aviso "a combinar" |
| Pix à vista (qualquer plano não recorrente) | Pix, como já funciona hoje | — | `paga` |

A primeira coluna precisa ser conferida na F1 contra `fn_checkout_2027_calcular` e o catálogo: Start pode ter opção de cartão 12x além da mensal. A regra atual não muda, e o site cobra apenas o que o servidor calcular como forma não recorrente.

**Cobrar só as consultas em 6x quando o plano é recorrente:** é possível, mas o custo é alto.
- Seria preciso um estado novo, `parcial`, com valor pago menor que o total.
- `pos_pagamento`, o e-mail e a notificação teriam que diferenciar pago total de pago parcial.
- A equipe ativaria um plano com uma parte paga e a outra pendente.
- A ativação da recorrência no futuro teria que considerar o que já foi pago.
- Risco: uma proposta "paga" que não está paga por inteiro. **Recomendação: não fazer nesta rodada.** Recorrência, com ou sem consultas, continua inteira em "a combinar".

## Migração `checkout_2027_cartao_token` (somente DDL)

```sql
ALTER TABLE public.rede_tokenizacoes ALTER COLUMN aluno_id DROP NOT NULL;
ALTER TABLE public.rede_tokenizacoes ADD CONSTRAINT rede_tok_dono_chk
  CHECK (aluno_id IS NOT NULL OR proposta_id IS NOT NULL) NOT VALID;
```
- `VALIDATE` em seguida, pois todas as linhas atuais têm `aluno_id`. `DROP NOT NULL` pede a confirmação do dono pela ferramenta.
- Índice em `rede_tokenizacoes(proposta_id)` onde não é nulo.
- `checkout_2027_tentativas`:
  - status `processando` e `desconhecido`;
  - colunas nulas `tokenizacao_id`, `consultado_em`, `bandeira`, `final_cartao`.
- `propostas_planos_2027`: colunas nulas `pagamento_parcelas`, `pagamento_nsu` e `pagamento_tid_mascarado`, se ainda não existirem.
- Índices únicos parciais: uma tentativa `processando` por proposta e um `pagamentos_rede` `approved` por proposta.
- RPCs `fn_checkout_2027_cartao_reservar`, `fn_checkout_2027_cartao_resultado` e `fn_checkout_2027_cartao_liquidado`: `SECURITY DEFINER`, `search_path` fixo, EXECUTE só para `service_role`.
- Flags `planos_cartao_real_ativo=false` e `planos_cartao_soft_descriptor=''`, gravadas por inserção de dado.
- `cartoes_salvos` não muda. RLS sem mudança.

## Fases (critérios por SQL)

**F1 — Banco.**
- `select is_nullable from information_schema.columns where table_name='rede_tokenizacoes' and column_name='aluno_id'` retorna `YES`.
- O CHECK está validado.
- As RPCs têm `prosecdef` e não têm EXECUTE para anon ou authenticated.
- `count(*) from rede_tokenizacoes where aluno_id is null` = 0.
- Contagens iguais: pagamentos_rede 47, vendas 434, pix 20, docs 369, `cartoes_salvos` inalterado.

**F2 — Servidor em simulação** (nada chama a Rede; a tokenização é simulada com estados `pendente → ativo/recusado/expirado`).
- Testes unitários: parcelas, chave, mapeamento do token e da transação, `sanitizarRaw`, máscara.
- Em transação desfeita:
  - duplo `reservar` gera 1 tentativa só;
  - a 4ª tentativa em 30 min é recusada;
  - proposta paga não aceita nova cobrança;
  - 3 recusas mantêm `aguardando_pagamento`.
- O desvio do webhook, com um aviso fictício de token de aluno, segue o caminho antigo, e o de proposta não toca em `cartoes_salvos` nem em `system_logs` com o raw.
- Os testes atuais da Loja e da Corrida passam sem alteração.

**F3 — Tela** (prévia admin, simulação).
- Proposta de teste aprovada: `etapa='paga'`, `pagamento_tipo='cartao'`, `pagamento_parcelas` igual ao escolhido.
- `rede_tokenizacoes` e `checkout_2027_tentativas` sem número nem nome do cartão.
- Recorrência continua mostrando "a combinar".

**F4 — Teste real de R$ 1,00. Só com pedido explícito do dono.** `real_baixo_valor`, 1x, NICOLAS TESTE.
- 1 linha em `rede_tokenizacoes` com `proposta_id`, `aluno_id` nulo e `status='active'`.
- 1 linha em `pagamentos_rede` com `amount=100` e `status='approved'`.
- Proposta paga, 1 aviso, e o modo voltou para `simulacao`.
- Fatura confere com "FORTEM" (se a conta aceitar).
- Estorno só quando o dono pedir.

**F5 — Liberação. Só com pedido explícito.** `planos_cartao_real_ativo=true`.
- A `tela_pagamento` pública mostra cartão real para os cenários não recorrentes e "a combinar" para recorrência.

## Riscos e mitigação

- **Webhook da Rede atrasa ou não chega:** `status_cartao` também consulta o token na Rede (no máximo a cada 30 s). Depois de 10 min sem ativação, a tentativa vira `expirado`.
- **Mudança no webhook quebrar Loja ou Corrida:** desvio só para `aluno_id IS NULL AND proposta_id IS NOT NULL`, teste de regressão com aviso fictício de aluno e caminho antigo sem nenhuma alteração.
- **`aluno_id` nulo quebrar consultas que esperam valor:** antes da F1, revisar com busca de texto quem lê `rede_tokenizacoes.aluno_id`. O CHECK garante que existe um dono.
- **Vazamento de dados sensíveis:** `sanitizarRaw`, nenhum `system_logs` com o raw no caminho da proposta e teste automático.
- **Cobrança em dobro:** lock, índices únicos, uma cobrança por token, nada de recobrar quando desconhecido, conciliação.
- **Cartões roubados testados em sequência:** Turnstile, 3 tentativas a cada 30 min e 10 por hora por IP.
- **Proposta meio paga:** recorrência fica inteira em "a combinar".
- **Reversão:** `planos_cartao_real_ativo=false` volta ao "a combinar". O CHECK e o `aluno_id` nulo ficam (não atrapalham a Loja). O desvio do webhook não roda se não houver tokens de proposta.

## Perguntas em aberto

- Q1: A transação com token exige o nome do titular e a validade. Validade pode ficar em `rede_tokenizacoes.token_expiration` (já é usado assim)? O nome pode ficar em `rede_tokenizacoes.cardholder_name` (a Loja já guarda), ou o dono prefere que a cobrança só aconteça na mesma requisição, aguardando a ativação por até 20 s e sem guardar o nome?
- Q2: Start pode ser pago em 12x no cartão ou só em mensal? A tabela trata Start como "a combinar" se for só mensal; o servidor decide pelo catálogo.
- Q3: Sem token ativo em 10 min, a tentativa vira `expirado`. Esse prazo está bom?
