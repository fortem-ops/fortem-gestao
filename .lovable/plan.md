# Checkout /planos 2027 no modelo da Loja

Só planejamento. Nada de cobrança real, nem mudança em catálogo, cron, Inter ou pix-webhook.

## 1. Como a Loja funciona hoje (o que confirmei no código)

Para o cliente (`src/components/store/CheckoutFlow.tsx`, cerca de 1.030 linhas): carrinho → dados (aluno logado ou visitante) → escolha Pix ou cartão → tela de Pix com QR, ou cartão (novo ou salvo, com parcelas) → sucesso.

No servidor:
- `loja-criar-pedido`: cria o pedido com `idempotency_key` (guardado no sessionStorage), recalcula o valor e o cupom no servidor e devolve `pedido_id` e `cartao_token` (`links_cartao`).
- Cartão: `rede-salvar-cartao` inicia a tokenização (`rede_tokenizacoes`), `loja-status-tokenizacao` acompanha (active / failed / recusado_bandeira) e `loja-cobrar-pedido` cobra pela Rede usando o token salvo em `cartoes_salvos`. O valor vem de `pedidos.valor_final`, as parcelas vêm do pedido, cada cobrança é registrada em `pagamentos_rede` e há limite por IP (`_shared/loja-rate-limit.ts`). Não há 3DS.
- Pix: `loja-criar-pix` cria a cobrança imediata no Inter (`/pix/v2/cob`, validade de 1800 s), reaproveita um Pix CRIADO ou ATIVO e responde "já pago" se o pedido já foi pago.
- Baixa: o `pix-webhook` marca o pedido como pago e liga o aluno (`fn_loja_vincular_aluno`). Enquanto isso, a tela consulta `loja-status-pedido` a cada poucos segundos.
- Aviso: `loja-enviar-confirmacao-email` (Gmail). Estorno manual por `loja-estornar-pedido`.

Dá para reaproveitar:
- O caminho de tokenização e cobrança pela Rede (`rede-salvar-cartao`, a acompanhamento de tokenização, `rede-cobrar-token`/`rede-cobrar-salvo`, `pagamentos_rede`, `cartoes_salvos`) e o `_shared/rede-auth.ts`.
- A chamada `interCobFetch` com `/cob` de 30 min.
- O padrão das telas: Pix com QR, acompanhamento de status, cartão salvo/novo, parcelas, sucesso.
- A idempotência por chave de sessão e o limite por IP.

## 2. O que muda na 2D e na Fase 4

O pagamento passa a usar a proposta (`propostas_planos_2027`), não o pedido. Ações novas na `planos-checkout`:
- `pagar_pix`: exige proposta em `contrato_aceito` com aceite válido e valor recalculado no servidor. Cria `/cob` de 30 min, ou reaproveita a que estiver ativa, grava em `pix_cobrancas` com `proposta_id` e muda o estado para `aguardando_pagamento`.
- `pagar_cartao`: mesma tokenização da Loja. A cobrança sai em 1x a 12x conforme a forma aceita no contrato; as parcelas nunca vêm do navegador.
- `pagar_recorrencia`: tokeniza, salva em `cartoes_salvos` e cobra só a 1ª mensalidade no ato. As outras 11 ficam como cobranças `pendente` com a marca `origem='planos_2027'`. O cron continua inativo.
- `status`: consultado pela tela, como na Loja.
- Baixa do Pix: o `pix-webhook` vai precisar de um novo ramo "proposta 2027". **Essa é uma mudança no pix-webhook e precisa de aprovação separada.** Até lá, a baixa é feita por conferência (GET do Inter) na própria ação `status`.

Diferenças inevitáveis em relação à Loja:
- Plano tem contrato com aceite e CPF obrigatório. Produto de loja não tem.
- A cobrança é bloqueada se o aceite perdeu validade (escolhas alteradas ou hash diferente).
- Plano gera mensalidades, recorrência e créditos. Pedido de loja só gera um pagamento.
- O cadastro de aluno, o contrato e o `contratos_documentos` só nascem depois do pagamento aprovado (Fase 5).
- Sem cupom e sem estoque.

## 3. Testar na prévia sem abrir para o público

O motivo atual está confirmado: `fn_checkout_2027_liberado` só libera com `planos_checkout_ativo=true` ou com proposta de teste (`fn_checkout_2027_teste`). Uma proposta da prévia que não está ligada ao NICOLAS TESTE cai em "A equipe entra em contato".

Opções:
- **A (recomendada): admin logado na prévia.** Na prévia (`?previa=1`), o site envia a sessão do admin. A `planos-checkout` confere no servidor (`has_role` admin) e marca a proposta com `teste_admin=true` e `criado_por`. `fn_checkout_2027_teste` passa a aceitar também essas propostas. Não depende de CPF de teste e o público continua bloqueado.
- B: lista de teste por e-mail em `sistema_config` (por exemplo, o e-mail do dono). É mais simples, mas qualquer pessoa que digite esse e-mail passaria pela trava.
- C: criar CPF próprio para o NICOLAS TESTE. Altera dados de aluno, e isso está fora da regra atual.

Propostas `teste_admin` nunca viram aluno real automaticamente. Na Fase 5, elas usam o aluno de teste.

## 4. Riscos

- **A Rede está em produção, sem sandbox.** Todo teste de cartão é cobrança real. Só será feito com seu pedido explícito, em valor simbólico, com estorno logo em seguida por `rede-cancelar`.
- Sem 3DS: o risco de fraude é o mesmo de hoje na Loja. Mantemos limite por IP e o Turnstile preparado.
- Pix: o teste também é real (R$ 1,00), só com seu pedido.
- O cron `cobrar-recorrencias-diario` continua inativo. As 11 mensalidades ficam pendentes e marcadas, e religar o cron só para 2027 é uma fase própria.
- Pix duplicado: evitado pela reutilização da cobrança ativa e pelo estado da proposta.
- Para reverter: as ações novas ficam atrás da trava. Basta remover a liberação `teste_admin` para voltar ao estado atual.

## 5. Subfases

- **2D-1 (teste por admin):** pequena migração (`teste_admin`, `criado_por` e ajuste em `fn_checkout_2027_teste`), sessão do admin aceita na `planos-checkout` e envio da sessão na prévia. Pronto quando: um admin percorre Identificação → Contrato sem o NICOLAS TESTE, e um anônimo continua recebendo "Checkout indisponível".
- **2D-2 (telas):** telas de Pagamento e Confirmação no padrão da Loja: escolha da forma, Pix com QR e contagem de 30 min, área do cartão. Botões em modo "reservado" (sem cobrança) e confirmação final. Nenhuma chamada à Rede ou ao Inter.
- **4A (Pix à vista):** ação `pagar_pix` com `/cob` de 30 min, mais `status` com conferência. Teste real de R$ 1,00 só com seu OK.
- **4B (cartão até 12x):** tokenização e cobrança reaproveitando a Loja. Teste real e estorno só com seu OK.
- **4C (recorrência no cartão):** cartão salvo, 1ª cobrança no ato e 11 pendentes marcadas. Cron inativo.
- **4D (baixa automática pelo webhook):** ramo da proposta no `pix-webhook`, com aprovação própria.
- **5:** ativação, aluno, contrato, `contratos_documentos`, créditos e e-mail (Resend).

## Decisões em aberto

1. Forma de teste: A (admin logado), B (e-mail em lista) ou C? Recomendo A.
2. A baixa do Pix na 4A vem por conferência na tela e o webhook fica para a 4D, ou já mexemos no webhook na 4A? Recomendo deixar para a 4D.
3. Na recorrência, a 1ª mensalidade é cobrada no ato e as 11 seguintes no mesmo dia dos meses seguintes? Recomendo que sim.
4. O valor simbólico para o teste real de cartão: R$ 1,00 com estorno no mesmo dia? Recomendo que sim.
5. O e-mail de confirmação do plano sai pelo Resend (como o código) e não pelo Gmail da Loja? Recomendo o Resend.
