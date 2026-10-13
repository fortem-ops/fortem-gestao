# Cartão de crédito real (Rede, 1x a 12x) no checkout público /planos

Substitui o "cartão a combinar" por cobrança real no cartão. Recorrência continua reservada. Nada é cobrado de verdade sem pedido explícito do dono.

## Estado atual (conferido)

- `planos-checkout` já tem as ações `pagar_cartao`, `cartao_combinar` e `tela_pagamento`. Fora da simulação, `pagar_cartao` grava a tentativa como `recusado/cartao_real_nao_liberado`, e a tela mostra "a combinar".
- `rede_tokenizacoes.proposta_id` **já existe** (criada no P0). Mas `aluno_id` é NOT NULL, o que trava o uso sem aluno.
- `pagamentos_rede` já tem `proposta_id` e `idempotency_key`.
- A Loja cobra em 2 tempos: `rede-salvar-cartao` tokeniza, o webhook `rede-tokenizacao-webhook` ativa o token (é assíncrono) e depois `loja-cobrar-pedido` pede o criptograma e cobra.
- Funções compartilhadas que podem ser reaproveitadas: `_shared/rede-auth.ts` (OAuth), `_shared/rede-payload.ts` (centavos, referência, nome do titular), `_shared/rede-recorrencia-core.ts` (`cobrarComToken`), `_shared/pagamento-motivo.ts` e `_shared/avisar-recusa.ts`.

## Decisão em aberto principal (P-1)

O pedido fala em reaproveitar a tokenização da Loja. Há duas formas de fazer isso:

- **Opção A, tokenização (igual à Loja):** cartão → token Rede → espera o webhook ativar → criptograma → cobrança. Exige permitir `aluno_id` nulo em `rede_tokenizacoes` (e em `cartoes_salvos`, se for usado). A espera pelo webhook leva segundos ou minutos, então a tela precisaria acompanhar o andamento. Guarda um token que só serviria para a recorrência, e ela está fora do escopo.
- **Opção B, recomendada: transação direta.** O número do cartão vai do navegador para a edge function, que repassa direto à Rede em `POST /transactions` (`capture:true`, `kind:credit`, `installments` vindo do servidor). Só fica gravado o resultado em `pagamentos_rede` (TID, NSU, autorização, final do cartão). Não é preciso tokenizar, não há webhook e nenhum token é guardado. Reaproveita `rede-auth`, `rede-payload`, o mapeamento de retorno e `avisar-recusa`. Mais tarde, a recorrência pode ligar a tokenização à proposta sem refazer nada.

O plano abaixo segue a **Opção B**. Se o dono preferir a A, entram a fase extra P1b (tokenização por proposta) e a mudança de `aluno_id` para nulo.

## Reutilizado e novo

Reutilizado sem alteração:
- `rede-auth.ts`, `rede-payload.ts`, `pagamento-motivo.ts`, `avisar-recusa.ts`.
- `fn_checkout_2027_pagamento_iniciar`: recalcula valor e parcelas, aplica o teto de R$ 1 e a reversão do modo teste.
- `fn_checkout_2027_pos_pagamento`, `planos-confirmacao` e `checkout_2027_tentativas`.

Novo ou alterado:
- `supabase/functions/planos-checkout/cartao.ts` (novo). Funções puras: validação de parcelas, montagem do payload, mapeamento do retorno da Rede (`aprovado | recusado | desconhecido`), máscara do TID e chave de idempotência.
- `supabase/functions/planos-checkout/cartao-rede.ts` (novo). Faz a chamada à Rede com timeout de 25 s e consulta por referência (`GET /transactions?reference=`) para conciliar.
- `planos-checkout/index.ts`: `pagar_cartao` passa a cobrar de verdade quando o modo e a flag permitirem. Nova ação `status_cartao`.
- `src/components/planos/PagamentoReservado2027.tsx`: formulário de cartão e seletor de parcelas.
- `src/config/planosPublicoTextos.ts`: textos.
- `supabase/functions/planos-checkout/AGENTS.md`: substitui a regra "Cartão real ainda não ligado".
- Migração `checkout_2027_cartao_real` (detalhes abaixo).

Não muda: Loja, Corrida, `rede-webhook`, `rede-tokenizacao-webhook`, Pix e `pix-webhook`, Pix Automático, catálogo, cron e dados de alunos.

## Regras de servidor

1. **Valor e parcelas.** O valor sai de `fn_checkout_2027_pagamento_iniciar(p_tipo:'cartao', p_parcelas)`, que recalcula a partir do aceite. O número de parcelas precisa estar entre as opções que o servidor já oferece para o plano: até 12x, e consultas até 6x quando a regra se aplicar. Parcela mínima: hoje não há regra (pergunta Q2). O front envia apenas o número de parcelas, que é validado contra essa lista.
2. **Dados do cartão.** Número, CVV e validade existem só na memória da requisição. Não vão para log, banco, `system_logs` nem `raw_response`: a resposta da Rede é limpa antes de gravar e fica só o final do cartão e a bandeira. O nome do titular não é gravado em `checkout_2027_tentativas`. CPF nunca é gravado.
3. **Sem 3DS.** A Rede pode recusar ou exigir autenticação conforme o emissor. Sem 3DS, a responsabilidade por chargeback de fraude é do lojista. Mitigações: Turnstile, limite de tentativas, vínculo com proposta e contrato aceito, e valores conhecidos. Recusas com código de "autenticação exigida" viram mensagem neutra.
4. **Limites.** No máximo 3 tentativas de cartão por proposta a cada 30 min, contadas em `checkout_2027_tentativas` com `tipo='cartao'`. Também 10 por IP por hora (`ckcard:i:`), somadas aos 120/h já existentes. Ao estourar, a mensagem é neutra: "Não foi possível processar agora. Tente mais tarde ou fale com a equipe."
5. **Idempotência e concorrência:**
   - Chave `proposta_id:aceite_id:n`, onde `n` é o número da tentativa. Fica em `pagamentos_rede.idempotency_key` e na `reference` da Rede, com 16 caracteres derivados por hash.
   - Novo índice único parcial: uma tentativa de cartão `processando` por proposta. Outro índice: um `pagamentos_rede` `approved` por proposta.
   - Antes de chamar a Rede, a tentativa passa para `processando` dentro da RPC, com `FOR UPDATE` na proposta. Duplo clique, nova aba ou retry recebem a mesma tentativa `processando` e nunca disparam uma segunda chamada.
   - Proposta já paga: não se cobra de novo e a resposta é "já pago".
   - **Timeout ou resposta desconhecida:** a tentativa fica `desconhecido` e não se cobra de novo. `status_cartao` consulta a Rede por referência, no máximo 1 vez a cada 30 s. Se a transação foi aprovada, dá baixa. Se foi negada ou não existe após 10 min, passa para recusado. Uma tentativa `desconhecido` em aberto bloqueia nova tentativa até ser resolvida, e a equipe é avisada.
6. **Aprovado:** nova RPC `fn_checkout_2027_cartao_liquidado`, no mesmo padrão de `fn_checkout_2027_pix_liquidado`. Ela grava `pagamentos_rede` (com `proposta_id`), marca a proposta `paga` com `pago_em`, `pagamento_tipo='cartao'`, `pagamento_ref`=TID, `pagamento_parcelas`, NSU e TID mascarado, e chama `fn_checkout_2027_pos_pagamento`. Depois, a função `planos-confirmacao` envia o e-mail. Não cria venda, pagamento financeiro, aluno nem contrato.
7. **Recusado:** a tentativa vira `recusado` com o motivo mapeado. A etapa continua `aguardando_pagamento` e a tela mostra "Tentar outro cartão". Esgotadas as 3 tentativas, a tela oferece Pix ou contato com a equipe, e a proposta não vira `falhou` (pergunta Q3). Um aviso de recusa sai para a equipe, uma vez por proposta.
8. **Ordem dos modos:** `simulacao` (nada chama a Rede) → `real_baixo_valor` (R$ 1,00, 1x, volta sozinho a simulação após um uso) → `real` (valor total), este último só por pedido explícito. O "a combinar" continua valendo para recorrência e, enquanto o modo `real` do cartão não for liberado, nova flag `planos_cartao_real_ativo=false`.

## Migração `checkout_2027_cartao_real` (somente DDL e funções)

- Novos estados em `checkout_2027_tentativas.status`: `processando` e `desconhecido`. Novas colunas nulas: `consultado_em`, `bandeira`, `final_cartao`.
- Colunas nulas em `propostas_planos_2027`: `pagamento_parcelas`, `pagamento_nsu`, `pagamento_tid_mascarado`, caso ainda não existam (verificar antes).
- Índices únicos parciais: um `processando` por proposta e um `approved` por `proposta_id` em `pagamentos_rede`.
- RPCs `fn_checkout_2027_cartao_reservar` (lock, limite de 3 a cada 30 min, estado `processando`), `fn_checkout_2027_cartao_resultado` e `fn_checkout_2027_cartao_liquidado`. Todas `SECURITY DEFINER`, com `search_path` fixo e EXECUTE só para `service_role`.
- Flag `planos_cartao_real_ativo=false` em `sistema_config`, gravada por inserção de dado, fora da migração.
- RLS sem mudança. Nenhuma tabela ganha acesso anônimo.

## UI (passo 8)

- Formulário com número (máscara e verificação Luhn), nome, validade, CVV e seletor de parcelas ("12x de R$ X", vindo do servidor). Campos sem autocomplete persistente. Nada vai para storage ou console.
- Estados: processando (botão travado e aviso "não feche a página"), aprovado (passo 9), recusado ("Tentar outro cartão"), desconhecido ("Confirmando com o banco…" e consulta a cada 8 s).
- Voltar e Alterar ficam escondidos durante `processando` ou `desconhecido` e depois do pagamento. "Modo simulação" aparece só na prévia admin.

## Fases (cada uma com critério verificável por SQL)

**F1 — Banco.** Migração e flag.
- Aceite: as funções aparecem em `pg_proc` com `prosecdef=true` e sem EXECUTE para anon ou authenticated. `planos_cartao_real_ativo='false'`. Contagens inalteradas: pagamentos_rede 47, vendas 434, pix 20, docs 369.

**F2 — Servidor em simulação.** `cartao.ts`, testes e ação `pagar_cartao` no modo simulação, ainda sem chamar a Rede.
- Aceite: os testes unitários passam (parcelas, chave, mapeamento de retorno, máscara, limpeza do raw). Em uma transação desfeita: um duplo `reservar` gera 1 só tentativa `processando`, a 4ª tentativa em 30 min é recusada e a proposta paga recusa nova cobrança. `select count(*) from pagamentos_rede` continua 47.

**F3 — Tela.** Formulário e estados, testados na prévia admin em simulação.
- Aceite: uma proposta de teste com cartão simulado aprovado fica `etapa='paga'`, `pagamento_tipo='cartao'`, e `checkout_2027_tentativas` não tem nenhum campo com número ou nome do cartão. Conferência: `select * from checkout_2027_tentativas where proposta_id=…`.

**F4 — Teste real de R$ 1,00. Só com pedido explícito do dono.** `real_baixo_valor`, 1x, cartão do dono, com NICOLAS TESTE.
- Aceite: 1 linha em `pagamentos_rede` com `proposta_id`, `amount=100`, `installments=1` e `status='approved'`. Proposta paga, 1 aviso, e o modo voltou para `simulacao`. Estorno via `rede-cancelar` só quando o dono pedir.

**F5 — Liberação. Só com pedido explícito.** `planos_cartao_real_ativo=true`. O "a combinar" continua só para recorrência.
- Aceite: na `tela_pagamento` pública, o cartão aparece como liberado e a recorrência como "a combinar".

## Riscos e mitigação

- Cobrança em dobro: lock, estado `processando`, índices únicos, nada de nova cobrança quando o resultado é desconhecido, e conciliação por referência.
- Vazamento de cartão: nada em log nem no banco, raw limpo e teste automático que procura dígitos do cartão no que é gravado.
- Uso para testar cartões roubados: Turnstile no cadastro, limites por proposta e por IP, e contrato aceito exigido.
- Valor manipulado: o servidor recalcula, e as parcelas são validadas pela lista do servidor.
- Chargeback sem 3DS: risco aceito pelo dono. Os registros guardam contrato com hash, IP e user agent.
- Rede fora do ar: mensagem neutra, Pix continua disponível e a equipe é avisada.
- Reversão: `planos_cartao_real_ativo=false` volta ao "a combinar". As funções novas ficam sem uso e nada é apagado.

## Perguntas em aberto

- Q1: Opção B (transação direta, recomendada) ou A (tokenização igual à Loja)?
- Q2: Existe parcela mínima, por exemplo R$ 50? Hoje nenhuma regra foi encontrada.
- Q3: Depois de 3 recusas, a proposta fica `aguardando_pagamento`, oferecendo Pix ou contato (recomendado), ou vira `falhou`?
- Q4: As consultas avulsas também passam a aceitar cartão (até 6x), ou só os planos?
- Q5: A cobrança deve aparecer na fatura com um nome específico (soft descriptor)?
