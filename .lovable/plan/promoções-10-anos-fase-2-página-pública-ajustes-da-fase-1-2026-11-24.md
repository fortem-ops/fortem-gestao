# Promoções 10 anos — Fase 2 (página pública) + ajustes da Fase 1

## 0. Ajustes da Fase 1
- **Desconto de ex-aluno R$ 400 → R$ 300.** Hoje o valor está duplicado: `PROMO10_DESCONTO_EX_ALUNO = 400` em `src/lib/promo10.ts` e `400.00` fixo três vezes em `fn_promo10_ofertas`. Nova migração recria a função lendo uma constante única no banco (`fn_promo10_desconto_ex_aluno()` → 300.00, imutável); o espelho em TS fica em `PROMO10_DESCONTO_EX_ALUNO = 300`, e um teste garante que os dois coincidem (ex.: 12x/Pix = catálogo − 300; recorrência = (mensalidade + 24,90) × 12 − 300 = R$ 25,00 a menos por mês). AGENTS.md atualizado.
- **Privilégios de `promo10_interesses`.** Conferido no banco: `anon` e `authenticated` ainda têm todos os privilégios (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) por padrão. A migração faz `REVOKE ALL ... FROM anon, authenticated`, depois `GRANT SELECT, UPDATE ... TO authenticated` (a RLS de admin continua filtrando). `service_role` mantém ALL + a sequência. Teste no banco: anon sem nenhum privilégio; authenticated só SELECT/UPDATE.

## 1. O que reaproveita do /planos
- `_shared/planos-verificacao.ts`: `cpfDigitosValidos`, `gerarCodigo`, `hashCodigo`, `mascararEmail`, `respostaEnvioPublica` (tempo de resposta igual com e sem cadastro).
- `_shared/planos-turnstile.ts` + tabela `planos_turnstile_passes` (passe de uso único) e o componente de Turnstile já usado no site.
- `fn_planos_resolver` (CPF → aluno por hash) e `fn_planos_limite` (limites por IP / CPF / e-mail).
- Envio pelo Resend (`nao-responda@soufortem.com.br`, resposta para contatofortem@gmail.com), com o mesmo filtro de teste: enquanto a chave `planos_codigo_email_livre` não estiver ligada, só os cadastros em `planos_codigo_email_teste_ids` recebem código. Para a promoção crio chaves próprias (`promo10_codigo_email_livre` = false, `promo10_codigo_email_teste_ids`) para não depender do estado do /planos.
- Não reaproveito a tabela `planos_verificacoes` nem `fn_planos_codigo_validar`: a promoção tem sessão e máximo de 5 tentativas próprios (abaixo).

## 2. Banco (uma migração, sem alterar dados existentes)
- `promo10_verificacoes`: id, aluno_id, email (só servidor), codigo_hash, tentativas (máx. 5), expira_em (10 min), enviado_em (reenvio após 60 s), validado_em. Só `service_role`; RLS ligada sem políticas.
- `promo10_sessoes`: token_hash (o navegador guarda o token, o banco só o hash), aluno_id, criada_em, expira_em (30 min, sem renovar). Só `service_role`.
- `fn_promo10_codigo_validar(id, hash)`: conta tentativa, bloqueia na 5ª, marca validado e cria a sessão. Execução só `service_role`.
- `fn_promo10_registrar_interesse(sessao, oferta_chave, frequencia)`: recalcula pela `fn_promo10_ofertas`, recusa oferta inexistente, aplica a regra de combinação e devolve `codigo_pedido`. Só `service_role`.
- Regra de combinação: no máximo 1 principal por aluno com status `novo`; escolher outra principal atualiza essa linha. Se a anterior já está `contatado`, a nova não substitui e a tela pede para falar com a equipe. Mesma oferta repetida (novo/contatado) atualiza em vez de duplicar. Corrida é uma linha à parte, também sem duplicar.

## 3. Edge function nova: `promo10-publico`
Ações (POST, sem login, Zod em tudo):
- `turnstile_config` / `turnstile`: mesmas regras do /planos.
- `enviar` (CPF + passe): limites 10/IP e 5/CPF por janela; resolve o aluno; resposta igual para CPF inexistente, sem e-mail, equipe ou bloqueado (tela "Vamos encontrar a melhor opção"). Equipe (papel de equipe) e as pessoas da equipe nunca entram. Devolve só `verificacao_id` + e-mail mascarado.
- `reenviar`: só após 60 s, invalida o código anterior.
- `validar` (id + código): até 5 tentativas; ao acertar, devolve `sessao` (token) + primeiro nome + ofertas calculadas.
- `ofertas` (sessão): recarrega as ofertas, usado em "Voltar às promoções".
- `interesse` (sessão + chave da oferta + frequência): grava e devolve `codigo_pedido`, resumo com valores e os interesses da sessão.
- Depois de 31/12/2026 23:59 (Brasília) todas as ações respondem `encerrada`.
- Logs em `system_logs` só com ids, e-mail mascarado e motivo — nunca CPF, código, token ou e-mail completo.
- O navegador nunca recebe aluno_id, CPF, e-mail completo, telefone ou plano além do que a oferta mostra (plano atual, dia do ciclo, data final).

## 4. Página `/10anos/promocoes`
Nova rota pública dentro do site, visual escuro FORTEM (fundo #0e0e0e, cartões #1a1a1a com borda 1px #4a4b4b, Archivo, títulos em caixa alta, cantos retos, botão #c8282a, cabeçalho "FORTEM" + selo "10 ANOS"), feita primeiro para o celular. O token da sessão fica só na memória da página (recarregar = recomeçar).
Telas, com os textos do pedido: 1 CPF · 2 Código · 3 Ofertas (Upgrade, Agregador, Ex-aluno, Corrida, cada uma com "Tenho interesse") · 4 Interesse registrado (resumo, prévia e botão "Falar no WhatsApp" com wa.me/555135199451?text=… incluindo o P10-xxxx) · 5 Sem oferta · 6 Promoções encerradas.
- Link "Promoções de aniversário" na página `/10anos`.
- Os textos de cálculo (X de Y dias, N ciclos, sem desconto, economia) saem de funções puras em `src/lib/promo10Texto.ts`, incluindo a mensagem do WhatsApp.

## 5. Como testar sem e-mail para alunos
- Testes automáticos (vitest + Deno): constante R$ 300 e valores; máscara de CPF; e-mail mascarado; mensagem do WhatsApp; regra de encerramento no fuso de Brasília; 5 tentativas; reenvio 60 s; sessão vencida após 30 min; interesse recalculado no servidor (valor enviado pelo navegador é ignorado); combinação 1 principal + Corrida; repetição atualiza em vez de duplicar; resposta igual para CPF inexistente/equipe.
- Teste real: `promo10_codigo_email_teste_ids` com apenas Bruna Meyer e NICOLAS TESTE; e-mail livre desligado, então nenhum outro aluno recebe código mesmo que alguém digite um CPF real. Rodo o fluxo pelo navegador local até o código chegar e registro um interesse; depois apago só os interesses de teste que eu criar.
- Antes de cada teste real eu te aviso qual cadastro vou usar.

## 6. Riscos
- Os cadastros de teste precisam ter segmento com oferta; se Bruna/NICOLAS TESTE caírem em "sem oferta", testo as telas de oferta por dados simulados e o envio real só até o código.
- E-mail desatualizado no cadastro faz o aluno cair no link do WhatsApp (esperado).
- Liberar para todos depende de ligar `promo10_codigo_email_livre` — fica para você decidir na publicação.
- Volume de e-mails no Resend se a campanha viralizar (limites por IP/CPF/e-mail ajudam).
- Interesse com status `contatado` bloqueia troca de principal; a equipe ajusta na Fase 3.

## Fora desta fase
Tela da equipe e aviso interno (Fase 3), cobrança/checkout, envio de WhatsApp pelo sistema, alteração de dados existentes, publicação.

## Arquivos
- Novos: migração `promo10_fase2`, `supabase/functions/promo10-publico/index.ts` (+ AGENTS.md e teste Deno), `supabase/functions/_shared/promo10-publico.ts` (regras puras), `src/pages/Promo10Promocoes.tsx`, `src/site/promo10/*` (telas e css), `src/lib/promo10Texto.ts`, `src/test/promo10Texto.test.ts`.
- Alterados: `src/lib/promo10.ts`, `src/test/promo10.test.ts`, `src/pages/Festa10Anos.tsx` (link), `src/App.tsx` (rota), `src/components/planos/AGENTS.md`, `src/site/AGENTS.md`.
