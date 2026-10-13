# Bloco de pagamentos do /planos 2027 (4A + 4B + 4D + Fase 5 enxuta)

Objetivo: abrir o recebimento pelo site reaproveitando o Pix imediato Inter e a Rede da Loja, com `planos_checkout_ativo=false` até o OK do dono.

## O que a leitura do código mostrou (base do plano)
- `loja-criar-pix`: Pix imediato `PUT /pix/v2/cob/{txid}` (30 min), reaproveita cobrança `CRIADA/ATIVA` do mesmo pedido, grava em `pix_cobrancas` (`pedido_id`).
- `pix_cobrancas` tem `pedido_id` e `corrida_venda_id`, **não tem `proposta_id`** — precisa de uma coluna nova.
- `loja-cobrar-pedido`: cobra pela tokenização ativa (`rede_tokenizacoes`), que hoje é ligada a **`aluno_id`** via `links_cartao`. Proposta de cliente novo não tem `aluno_id` → ponto de decisão (abaixo).
- `pagamentos_rede` já tem `idempotency_key`, `pedido_id`, `venda_id`; `vendas` tem `origem` e `idempotency_key`.

## Subfases (cada uma conferível no banco)

### P0 — Banco (1 migração)
- `pix_cobrancas.proposta_id` e `pagamentos_rede.proposta_id` (uuid, nulos, com índice; linhas atuais intactas).
- Unicidade parcial: uma única cobrança Pix `ATIVA/CRIADA` por proposta e um único `pagamentos_rede` aprovado por proposta.
- `propostas_planos_2027`: `pago_em`, `pagamento_tipo`, `pagamento_ref`. Etapas novas: `aguardando_pagamento` → `paga` | `falhou` | `expirada`.
- Funções `fn_checkout_2027_pix_registrar`, `fn_checkout_2027_marcar_paga` (idempotente: se já `paga`, não faz nada), só `service_role`, `search_path` fixo.
- Chaves em `sistema_config`: `planos_pagamento_modo_teste` (`simulacao` | `real_baixo_valor`, padrão `simulacao`) e `planos_teste_valor_max_centavos` (padrão 100).
- Conferência: contagens de pix_cobrancas/pagamentos_rede/pagamentos/vendas iguais antes e depois.

### P1 — Pix à vista (4A)
- `planos-checkout` ação `pagar_pix`: exige `contrato_aceito` com aceite válido (mesma checagem do `tela_pagamento`), forma `pix_vista`, valor recalculado por `fn_checkout_2027_calcular`; reaproveita cobrança ativa; senão cria `cob` 30 min (mesmo helper `interCobFetch` da Loja), grava `pix_cobrancas` com `proposta_id`, etapa `aguardando_pagamento`.
- Ação `status_pix`: lê o banco; se ainda ativa, faz **GET** `/pix/v2/cob/{txid}` no Inter e, se `CONCLUIDA`, chama `fn_checkout_2027_marcar_paga`. Expirada → etapa `expirada`, botão "Gerar novo Pix".
- Tela: QR (gerado do copia e cola no navegador), botão copiar, contagem de 30 min, consulta a cada 5 s, mesmo visual do CheckoutFlow da Loja.
- CPF do devedor vem de `cpf_cifrado` no servidor; nunca volta ao navegador.

### P2 — Cartão até 12x (4B)
- Tokenização: reaproveitar `rede-salvar-cartao`/fluxo de tokenização da Loja (campos do cartão vão direto ao fluxo já usado pela Loja, nunca passam por log nosso).
- Ação `pagar_cartao`: valor e parcelas **só** do servidor (ignora o que vier do navegador); `idempotency_key = proposta_id + aceite_id`; limite 5/min por IP e 3 tentativas por proposta a cada 30 min; grava `pagamentos_rede` com `proposta_id`. Aprovado → `marcar_paga`; recusado → etapa `falhou`, mensagem neutra e "Tentar outro cartão". Sem 3DS, como na Loja.
- Cartão recorrente (4C) fica fora: na tela continua "reservado".

### P3 — Baixa pelo webhook (4D)
Diff conceitual em `pix-webhook/index.ts`, no laço de `payload.pix`, logo após buscar `cob`:
```text
select ... , proposta_id            (só adiciona a coluna)
+ if (!cob.pedido_id && !cob.corrida_venda_id && cob.proposta_id) {
+   await tratarPix2027(sup, cob, ev)   // novo arquivo pix-webhook/proposta2027.ts
+   pixTratados.add(txid); continue;
+ }
```
- `tratarPix2027`: se `pix_cobrancas` já `LIQUIDADA`, só registra e sai; senão marca `LIQUIDADA` e chama `fn_checkout_2027_marcar_paga` (idempotente). Erros em `system_logs` sem CPF.
- Loja, Corrida e Pix Automático: caminho idêntico (cobranças sem `proposta_id` nunca entram no ramo).
- Testável sem cobrança: testes unitários de `tratarPix2027` com cliente falso (1ª chamada paga, 2ª não duplica, cobrança de Loja/Corrida não entra no ramo); chamada ao webhook com token e payload fictício de txid inexistente → nenhuma linha muda; sem token → 401.

### P4 — Fase 5 enxuta (após pagamento aprovado)
`fn_checkout_2027_marcar_paga`, em uma transação:
- proposta → `paga`, `pago_em`, referência do pagamento;
- `vendas` (origem `site_2027`, `idempotency_key = proposta_id`, `status_pagamento='pago'`) e `pagamentos` coerentes com o fluxo atual, com `aluno_id` quando o vínculo foi confirmado; senão nulo e marcado "a vincular";
- notificação interna "Nova compra do site — pagamento aprovado" para admins, com plano, forma, valor e checklist do que ativar.
- E-mail ao cliente pelo Resend (`FORTEM <nao-responda@soufortem.com.br>`, Reply-To contatofortem@gmail.com): plano, total, forma, próximos passos; sem CPF, sem cartão. Enviado uma única vez (marca na proposta).
- Proposta `teste_admin`: nunca cria venda/pagamento real; só a notificação com "[TESTE]".

Falta para a ativação automática completa (próxima fase): criar/vincular aluno (regra para cliente novo e cadastro suspeito), `planos` + `contratos` + `contratos_documentos` a partir do aceite, créditos 2027 (`fn_creditos_mensais_2027`), parcelas/mensalidades e Clube. Exige: decisão sobre cliente sem vínculo confirmado, e revisão das regras de plano principal (`fn_plano_principal_ativo`).

## Segurança / LGPD
- CPF e cartão nunca em log, URL, console ou storage; logs só com id da proposta.
- Turnstile: o dono cria um site no Cloudflare Turnstile para soufortem.com.br e me passa a chave do site (pública) e adiciona a chave secreta nos Secrets; depois ligo a chave em `sistema_config`.
- `planos_checkout_ativo` continua `false`.
- Propostas `teste_admin`/lista de teste: em `simulacao` nenhuma chamada ao Inter/Rede (resposta falsa marcada como simulada, sem gravar em tabelas financeiras). Em `real_baixo_valor`, o servidor **recusa** qualquer cobrança acima de `planos_teste_valor_max_centavos` (R$ 1,00) e substitui o valor pelo teto — trava no servidor, não na tela. Volta sozinho para `simulacao` após um uso.

## Testes
- Unitários: valor/parcelas do servidor, idempotência Pix e cartão, trava de valor máximo, ramo do webhook, `marcar_paga` duas vezes.
- Simulação ponta a ponta como admin na prévia (Pix e cartão, aprovado/recusado/expirado) e conferência por consulta: proposta, vendas, pagamentos, notificação.
- Roteiro real (só quando o dono pedir): ligar `real_baixo_valor`; Pix R$ 1,00 com NICOLAS TESTE → pagar → conferir baixa pelo webhook e pela tela; cartão R$ 1,00 → aprovado → estorno pela função existente de estorno quando o dono pedir; voltar para `simulacao`.

## Riscos e reversão
- Desligar: `planos_checkout_ativo=false` (público) e modo `simulacao` (testes).
- Webhook: remover o `if` do ramo 2027 e republicar; nada mais muda.
- Colunas novas são nulas; não afetam telas atuais.
- Não será tocado: catálogo 2027, cron `cobrar-recorrencias-diario` (segue inativo), Loja, Corrida, Pix Automático, cadastro de alunos.

## Decisões em aberto para o dono
1. Cartão de cliente sem cadastro: a tokenização da Rede hoje exige `aluno_id`. Opções: (a) ligar a tokenização à proposta (coluna nova em `rede_tokenizacoes`, recomendado) ou (b) só aceitar cartão de quem tem vínculo confirmado nesta fase.
2. Venda de cliente sem vínculo: registrar já em `vendas` com aluno a vincular, ou só na ativação.
3. Tentativas de cartão por proposta (proposto: 3 a cada 30 min).
4. Texto final do e-mail de confirmação (envio rascunho para aprovação).
