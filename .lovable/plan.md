# Plano 2 — Etapa P2: autorização do Pix Automático depois do 1º mês

Só a P2. P3 (telas), P4 (cobranças mensais e retentativas), P5 (cancelamento pelo cliente e aviso aos admins), P6 (teste real), P7 e P8 ficam de fora. Tudo continua atrás de `planos_pix_automatico_ativo` (hoje false) e `planos_pix_automatico_planos` (hoje []). O Start não entra em nenhuma lista.

## Resumo para o dono

1. O cliente escolhe "Pix Automático" (a tela vem na P3) e paga o 1º mês por Pix comum, no mesmo valor do 1º mês do cartão.
2. Quando o banco confirma esse pagamento, o plano é ativado como hoje.
3. Depois disso, o checkout gera **um** pedido de autorização do débito automático no Inter. O 1º débito fica no 2º vencimento e o valor mínimo é igual à mensalidade.
4. O cliente vê o código, que vale 7 dias, e autoriza no app do banco. Pode pedir um novo código no máximo 3 vezes por proposta.
5. O aviso do Inter muda o estado para autorizada, recusada ou vencida. Nada é cobrado na P2.

## O que foi conferido no sistema

- `pix_recorrencias` exige `aluno_id` e não tem ligação com proposta. Há um índice único só em `id_rec`. Hoje existem 3 linhas, todas CANCELADAS (testes).
- `_shared/pix-rec.ts` já cria a recorrência (`/rec`) e já lê CPF e nome do aluno pelo servidor. O teste da jornada 2 (`locrec` + `rec` com loc + leitura do `dadosQR.pixCopiaECola`) está em `inter-consulta-pix-automatico`.
- `pix-webhook` já aceita avisos `rec/recs`: APROVADA→AUTORIZADA, REJEITADA, EXPIRADA e CANCELADA, com regra para não voltar de um estado final. Também já exige `?token=` com o segredo.
- **Achado:** `pix-webhook/index.ts` (linha 85) grava no log o aviso inteiro, sem mascarar. Num aviso de recorrência isso inclui o CPF do pagador. A P2 corrige isso.
- `fn_mensalidade_2027_validar` exige cartão da proposta ou do aluno em toda mensalidade, então recusaria qualquer linha Pix.
- A proposta já tem `forma_plano`, `aluno_ativado_id`, `venda_id`, `contrato_id`, `cpf_hash` e `cpf_cifrado`.

## 1. O que muda, arquivo a arquivo

**Nova `_shared/pix-automatico-2027.ts`** (só funções puras e chamadas ao Inter):
- `montarRecorrencia2027`: monta o pedido da recorrência a partir da proposta.
- `criarCodigoAutorizacao`: `locrec`, depois `rec` com loc, depois lê o copia e cola.
- `consultarRec`: GET `/rec/{idRec}`.
- `mascarar`: reaproveita a de `pix-rec.ts`.

`pix-rec.ts` não é alterado. As funções da equipe continuam como estão.

**`planos-checkout/`:**
- Novo `pix-automatico.ts`, com duas ações:
  - `autorizacao_pix`: cria ou devolve o código.
  - `novo_codigo_pix`: pede um código novo.
- `index.ts`: só acrescenta essas duas ações no roteador. Elas recusam logo no início se as duas liberações não permitirem o plano da proposta.
- `pagamento.ts`: quando a forma é `pix_automatico`, o 1º mês segue o mesmo caminho do Pix à vista. O valor vem de `calcularVenda2027` (1º mês, mais a taxa de R$ 24,90 em Power e Pro), conferido no servidor. Esse ramo só existe com a forma `pix_automatico`. Nenhuma linha dos ramos de cartão ou Pix à vista muda.
- Novo `pix-automatico_test.ts`.

**`pix-webhook/`:**
- `index.ts`:
  - O log do aviso bruto passa a sair mascarado (corrige o achado).
  - No ramo `rec`, quando a recorrência tem `proposta_id`, chama o novo `planos-autorizacao.ts`. As recorrências da equipe continuam no caminho atual.
- Novo `planos-autorizacao.ts`, com testes em `planos-autorizacao_test.ts`.
- `eventos.ts`: sem mudança.
- `planos-baixa.ts`: só ganha um teste mostrando que a baixa do 1º mês de uma proposta Pix Automático é idêntica à do Pix à vista.

**Como o cartão e o Pix à vista ficam intactos:**
- Ramos novos só com `forma_plano = 'pix_automatico'`, e esse valor só é aceito com as liberações ligadas.
- Nenhuma função `fn_checkout_2027_cartao_*`, `fn_recorrencia_2027_*` ou `planos-recorrencia-diario` muda de comportamento. A única exceção é o filtro do item 6.
- Os testes atuais de cartão, pagamento e baixa (Vitest e Deno) precisam continuar passando sem edição.
- O ensaio desfeito compara impressões digitais das mensalidades, propostas e configurações antes e depois.

## 2. Quando a autorização nasce e como se evita duplicidade

- **Condição:** a proposta está paga **e** ativada (`aluno_ativado_id` e `contrato_id` preenchidos), com forma `pix_automatico` e plano liberado. A ativação já acontece na baixa de hoje (`fn_checkout_2027_pos_pagamento`).
- **Momento:** a recorrência é criada quando a tela, que consulta o estado, chama `autorizacao_pix`. O aviso do banco **não** chama o Inter. Assim o aviso continua rápido e não chama o banco de novo. Quem chega primeiro, a tela ou uma nova consulta, cria. Os demais recebem a mesma.
- **Trava atômica**, pela nova `fn_pix_automatico_2027_reservar` (só servidor):
  - trava a linha da proposta;
  - se já existe recorrência ativa (CRIADA, AGUARDANDO ou AUTORIZADA), devolve a existente;
  - senão, reserva o número do código (até 3) e marca "criando".
- **Garantia no banco:** índice único em `pix_recorrencias (proposta_id)` para status não finais. Duas recorrências vivas para a mesma proposta são impossíveis.
- **Baixa repetida:** já é idempotente (`ja_processado`) e não cria nada novo.
- **Baixa fora de ordem:** sem baixa e ativação, `autorizacao_pix` responde "aguardando pagamento" e não chama o Inter.
- **Falha no meio** (Inter criou e a gravação falhou): uma nova tentativa de gravação. Se falhar de novo, o log `pix_aut_registro_falhou` vai para os admins, e a reserva fica "desconhecido", sem criar outra sozinha. É a mesma regra do Pix à vista.

## 3. Dados e migração

Será uma migração separada, mostrada antes de aplicar ("P2a"), sem regravar linhas existentes.

- `pix_recorrencias`, colunas novas:
  - `proposta_id uuid` (ligação com propostas_planos_2027), `contrato_id uuid` e `venda_id uuid`, todas opcionais;
  - `origem text default 'equipe'` ('equipe' ou 'site_2027');
  - `codigo_expira_em timestamptz`;
  - `codigo_numero int` (1 a 3).
  - Mais o índice único parcial do item 2.
- `propostas_planos_2027`: `pix_aut_codigos int default 0` e `pix_aut_estado text`, com os valores: nenhum, criando, aguardando, autorizada, recusada, vencida, esgotada, desconhecido.
- `forma_plano`: passa a aceitar `pix_automatico` (validação no servidor, nunca vinda do navegador).
- Novas funções, todas só para o servidor:
  - `fn_pix_automatico_2027_reservar`, `_registrar` e `_estado`;
  - `fn_pix_automatico_2027_liberado`, que lê as duas liberações; ausência = desligado.
- Item 6 (abaixo) na mesma migração.
- Rollback em `scripts/pix-automatico-p2.rollback.sql`.

## 4. O que o servidor entrega à tela (a tela é da P3)

- `autorizacao_pix` devolve:
  - `estado`;
  - `copia_e_cola` e QR, só para o próprio checkout da proposta, nunca em log;
  - `expira_em`;
  - `codigos_restantes`;
  - `primeiro_debito` (2º vencimento);
  - `valor_mensal`.
- **Consulta do estado:** a ação `estado` já existente ganha o bloco `pix_automatico`, lido primeiro do banco. Se estiver "aguardando" e o último GET tiver mais de 30 s, consulta `/rec/{idRec}` como reserva, com o mesmo limite por proposta do Pix à vista.
- **`novo_codigo_pix`:** só depois que o código atual venceu ou foi recusado e se `pix_aut_codigos < 3`. Primeiro cancela no Inter a recorrência anterior que não foi autorizada, depois cria a nova, na mesma trava. Assim nunca há duas vivas. Na 3ª falha: estado "esgotada" e aviso à equipe (resolver ou trocar para cartão, só admin).
- **Validade do código:** 7 dias, mas nunca depois da véspera do 2º vencimento.

## 5. O aviso do Inter (pix-webhook)

- **Origem:** o segredo na URL continua obrigatório. Além disso, antes de gravar AUTORIZADA, `planos-autorizacao.ts` confirma com GET `/rec/{idRec}`. O conteúdo do aviso sozinho não autoriza nada.
- **Por tipo:**
  - APROVADA/AUTORIZADA: estado "autorizada" na proposta e log.
  - REJEITADA: "recusada", mais aviso único à equipe por proposta.
  - EXPIRADA: "vencida".
  - CANCELADA: antes de autorizar, vira "vencida". Depois de autorizada, só faz log e um aviso aos admins com marcação "P5 pendente". Multa e tratamento ficam para a P5.
- **Idempotência:** `podeAtualizarRec`, que já existe, impede regredir e repetir. O mesmo aviso duas vezes não grava nada.
- **system_logs** (módulo `pix-automatico-2027`): idRec, proposta, estado antes e depois, CPF só com os 3 últimos dígitos. Nunca copia e cola, nome completo ou token.

## 6. Verificação de mensalidade e funções do cartão

Recomendação: **fazer na P2** (migração P2a), antes que qualquer linha Pix possa existir. O cronograma Pix só nasce na P4, mas assim a proteção fica pronta antes.

- `fn_mensalidade_2027_validar`: acrescenta no início `IF NEW.meio = 'pix_automatico' THEN` com as regras próprias: `pix_recorrencia_id` da mesma proposta ou aluno, mais as mesmas regras de campos imutáveis e de status. O ramo do cartão fica com o texto idêntico.
- `fn_recorrencia_2027_devidas` e `_reservar`, e a leitura do `planos-recorrencia-diario`: ganham `AND meio = 'cartao'`. Hoje todas as linhas são cartão, então o resultado é o mesmo.
- **Risco para o cartão:** baixo, mas são funções que cobram.
- **Prova:**
  - comparar o texto das funções antes e depois (só a linha nova muda);
  - ensaio desfeito: as devidas de hoje são iguais, linha por linha; a Larissa (mensalidade 2) continua devida em 20/11; a mensalidade de cartão sem cartão continua recusada;
  - testes Deno do `planos-recorrencia-diario` sem mudança.

## 7. CPF do pagador

- O devedor e o destinatário da recorrência saem sempre do aluno ativado (`fn_reveal_cpf_service`) e são conferidos com `propostas_planos_2027.cpf_hash`. Se não baterem, o servidor recusa e avisa a equipe. Nunca usa CPF vindo da tela.
- **Se o cliente tentar autorizar com outra conta ou CPF** e o banco recusar: vira "recusada", com a mensagem "a autorização precisa ser feita na conta do titular do contrato". Ele pode pedir novo código (conta no limite de 3), e a equipe é avisada.

## 8. Testes sem cobrar ninguém

**Antes do P6, já se prova:**
- os testes de unidade: valor do 1º mês e taxa, liberação desligada recusa tudo, Start recusado, limite de 3 códigos, aviso repetido, regressão, máscara de CPF, ramos do cartão e do Pix à vista sem mudança;
- o ensaio SQL desfeito: trava e índice único, duas reservas simultâneas, verificação da mensalidade Pix e do cartão, filtro `meio`, impressões digitais iguais;
- os avisos simulados no pix-webhook com idRec inexistente.

**Só se prova com o Inter (P6, dono, R$ 1,00):**
- criação real do código com loc em proposta de teste;
- o aviso de autorização chegando com proposta ligada;
- vencimento e recusa reais;
- a confirmação por GET;
- o 1º débito no 2º vencimento (já P4).

## 9. Risco, reversão, publicação e custo

- **Risco:** baixo com as liberações desligadas. Os pontos sensíveis são a mudança do item 6 e o filtro no aviso do banco.
- **Reverter:**
  - deixar `planos_pix_automatico_ativo=false` (já está);
  - rodar o script P2a de volta, que volta o texto anterior das funções e funciona enquanto não houver linha `site_2027`;
  - republicar `planos-checkout` e `pix-webhook` na versão anterior.
- **Migração:** sim, a P2a, separada, mostrada antes. A ferramenta deve pedir aprovação, porque altera funções de cobrança.
- **Publicar:** o site não precisa. As funções `planos-checkout` e `pix-webhook` precisam ser republicadas (entram no ar com as liberações desligadas). Nenhum cron novo.
- **Custo estimado:** P2a cerca de 3–5 mensagens; código e testes 6–10; ensaio e conferência 2–3. No total, cerca de 12–18 mensagens.
- **Dependências:**
  - Inter: confirmar que `locrec` e `rec` com loc continuam na jornada 2 e que o aviso `rec` é enviado para o mesmo endereço;
  - advogado: só para o Start e o texto de consentimento (P3).

## 10. Riscos e perguntas para o dono

1. **Momento:** a autorização nasce quando o cliente está na tela depois de pagar, e não pelo aviso do banco. Se ele fechar a página antes, o código nasce quando voltar pelo link da proposta. Aceita? A alternativa é criar já no aviso, mas isso deixa o aviso dependente do Inter.
2. **Pix do 1º mês dentro da P2:** o servidor já aceitaria a forma `pix_automatico` (desligada) para dar para testar na P6. Ou prefere deixar isso para a P3?
3. **Esgotou os 3 códigos:** a equipe só recebe aviso, ou o sistema deve sugerir a troca para cartão (só admin, como decidido)?
4. **Correção do log sem máscara no aviso do banco:** como é segurança e é independente do Pix Automático, posso fazer antes, isolada?
5. **Incerteza:** o Inter pode exigir uma nova recorrência ou só uma nova loc para gerar código novo. O plano cancela e cria de novo. Isso será confirmado no P6.
