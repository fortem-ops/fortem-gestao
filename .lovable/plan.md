# Disparo de Mensagens — Fase 1 (plano para aprovação)

Escopo: modelos, disparos avulsos por E-mail e WhatsApp, histórico. Fora: push, agendamento, automações, migração das regras de Sistema > WhatsApp.

## O que já foi conferido no banco/código
- `alunos.status` tem hoje: ativo 248 (6 da equipe), inativo 686, lead 903, prospect 12, avulso 7, **cancelado 2** (não citado no pedido — ver pergunta 1).
- `alunos` tem `email` e `telefone` (não há coluna `whatsapp`); "tem WhatsApp" = telefone que passa em `normalizarTelefone`.
- `festa_confirmacoes` **não tem `aluno_id`**: guarda `nome`, `email`, `whatsapp`. Decidido: o cruzamento "já confirmou" será feito SOMENTE por telefone/WhatsApp normalizado.
- `send-whatsapp` já aceita modo template (`template_name`, language, components) e valida o usuário logado; `_shared/whatsapp.ts` tem `normalizarTelefone` e `callSendWhatsApp`; `_shared/resend.ts` tem `enviarResend(to, assunto, html, texto)`.
- Menu: grupo Comercial em `AppSidebar.tsx` já tem lista `comercialAdminItems` exibida só com `isAdmin`.

## 1) Arquivos
Novos:
- `src/pages/Disparos.tsx` — página com 4 abas; `if (!roles?.isAdmin) <Navigate to="/" />`.
- `src/components/disparos/DisparosAvulsos.tsx` (lista + "Novo disparo")
- `src/components/disparos/NovoDisparoWizard.tsx` com `PassoPublico.tsx`, `PassoMensagem.tsx`, `PassoRevisar.tsx`
- `src/components/disparos/PreviaWhatsApp.tsx`, `PreviaEmail.tsx`
- `src/components/disparos/DisparosModelos.tsx` + `ModeloForm.tsx`
- `src/components/disparos/DisparosHistorico.tsx`
- `src/components/disparos/DisparosAutomaticos.tsx` (estado "em breve")
- `src/lib/disparos.ts` — funções puras: variáveis (`%NOME_ALUNO%`, `%PRIMEIRO_NOME%`, `%EMAIL%`, `%TELEFONE%`, `%LINK_FESTA%`, `%PRAZO_CONFIRMACAO%`), montagem dos `components` do template, regras de exclusão por motivo.
- `src/test/disparos.test.ts` — exclusões (equipe, sem contato, confirmado, opt-out), substituição de variáveis, contagem por canal.
- `supabase/functions/disparo-campanha/index.ts` (+ `AGENTS.md` com as regras)
Alterados (mínimo):
- `src/components/AppSidebar.tsx` — 1 item em `comercialAdminItems` ("Disparo de Mensagens", `/comercial/disparos`).
- `src/App.tsx` — 1 rota lazy dentro da mesma proteção das rotas de staff.
- `AGENTS.md` raiz — 1 regra apontando para o AGENTS.md da função.
Não alterar: `send-whatsapp`, `whatsapp-webhook`, `whatsapp-disparo-*`, `whatsapp_disparos_config/log`, Notificar/Gmail.

## 2) Migrações (só descrição)
M1 (etapa 1) — `msg_modelos`: id, nome, canal ('email'|'whatsapp'), meta_nome, idioma (default 'pt_BR'), categoria ('MARKETING'|'UTILITY'), texto, variaveis jsonb (`[{pos:1, fonte:'campo'|'fixo', valor:'primeiro_nome'|'https://...'}]`), assunto, corpo_html, status ('rascunho'|'a_cadastrar'|'aprovado'), ativo, criado_por, timestamps.
M2 (etapa 2) — opt-out: tabela própria `msg_optout` (canal, email_norm, telefone_norm, aluno_id null, motivo, origem 'manual'|'link', criado_em/por), única por canal+contato. Tabela própria (e não campo no cadastro) porque cobre também contatos sem cadastro e não toca `alunos`.
M3 (etapa 3) — `msg_campanhas`: id, nome, canais text[], filtro jsonb, modelo_email_id, modelo_whatsapp_id, assunto/corpo/variaveis efetivos (snapshot do conteúdo), status ('rascunho'|'enviando'|'enviado'|'pausado'), total_previsto, criado_por, enviado_em, timestamps.
  `msg_campanha_destinatarios`: id, campanha_id, aluno_id, canal, contato (e-mail/telefone normalizado), nome, status ('pendente'|'enviado'|'falhou'|'nao_enviado'), motivo_exclusao, wamid, erro, tentativas, enviado_em, e já preparados para fase 2: entregue_em, lido_em (nulos). `UNIQUE (campanha_id, aluno_id, canal)` impede duplicidade.
Todas: GRANT só authenticated + service_role, RLS com `has_role(auth.uid(),'admin')`; `msg_campanha_destinatarios` só leitura para admin (escrita só pela função). Cada migração com script de rollback em `scripts/`.

## 3) Edge function `disparo-campanha`
Ações: `teste` (envia 1 e-mail e/ou 1 WhatsApp para contato digitado, não grava destinatários), `preparar` (gera o snapshot no servidor recalculando o público — não confia na lista do navegador; grava excluídos como 'nao_enviado' com motivo), `enviar` (processa um lote) e `status`.
- Autorização: valida JWT e `has_role(admin)`; senão 403.
- Ritmo: cada chamada pega até 20 pendentes com `FOR UPDATE SKIP LOCKED` (marca 'enviando' antes), WhatsApp ~1 msg/s, e-mail ~5/s (limite Resend); a tela chama o próximo lote enquanto houver pendentes e mostra progresso. Se a página fechar, "Retomar" continua só os pendentes. Sem cron nesta fase.
- Idempotência: só envia linhas 'pendente'/'falhou' (reenvio = "reenviar falhas"); linha 'enviado' nunca reenvia. E-mail com header `Idempotency-Key` = id da linha.
- WhatsApp: chama a API Meta via o mesmo caminho do `send-whatsapp` (`callSendWhatsApp`, modo template, sem texto livre); guarda `wamid`. Erros 131xxx gravados no `erro`. Pausa a campanha se 5 falhas seguidas.
- Trava de desenvolvimento: secret/flag `DISPAROS_REAL_LIBERADO` desligada → só a ação `teste` funciona até a etapa 5 ser aprovada.

## 4) Riscos e dúvidas técnicas
- Cruzamento com a festa por e-mail/telefone pode falhar se a pessoa confirmou com outro contato (alguns convidados repetidos).
- Contato sem cadastro no envio: só cadastros de `alunos` entram; quem não tem e-mail/telefone válido vira "não enviado".
- 686 inativos: muitos telefones antigos; risco de baixa qualidade do número na Meta (bloqueios). Sugiro primeira leva pequena (ex.: 50) antes do restante.
- Modelo de marketing exige aprovação da Meta e janela de opt-out; o texto deve trazer "responda SAIR para não receber" — o registro de SAIR vindo do webhook é fase 2 (nesta fase, opt-out é cadastrado à mão na tela).
- E-mail precisa de link de descadastro para não cair em spam; proposta: link com token para página pública simples que grava em `msg_optout` (incluir na etapa 4 ou adiar — pergunta 4).
- Equipe: excluir `is_equipe = true` sempre, no servidor.

## 5) Etapas (aprovação uma a uma)
1. Menu + rota + página com abas vazias + M1 + aba Modelos (CRUD, status manual). Nada enviado.
2. M2 + aba Público (filtros, busca, seleção, lote, exclusões, resumo) + cadastro manual de opt-out. Só leitura.
3. M3 + passo Mensagem (modelos, variáveis, prévias) + função com ação `teste` apenas. Envio só para o e-mail/telefone digitado.
4. Revisar e enviar + `preparar` + confirmação com total; envio real ainda travado pela flag. Aba Histórico.
5. Liberação da flag após sua aprovação; primeira leva do convite da festa (inativos, sem confirmados), primeira leva de 50 destinatários.

## Respostas do dono
1. Inativos/ex-alunos = inativo + cancelado.
2. Cruzamento com a festa só por telefone normalizado.
3. %LINK_FESTA% = https://soufortem.com.br/10anos.
4. Link de descadastro no e-mail entra na etapa 4.
5. Primeira leva real: 50 destinatários, depois o restante.
6. Teste só para contatos digitados.

## Perguntas (respondidas acima)
1. Status `cancelado` (2 cadastros) entra no chip "Inativos/ex-alunos" ou fica de fora?
2. O cruzamento com a festa por e-mail OU telefone está ok?
3. Variáveis extras sugeridas (`%LINK_FESTA%`, `%PRAZO_CONFIRMACAO%`) — o link da festa é `https://soufortem.com.br/10anos`?
4. Link de descadastro no e-mail: incluir já na Fase 1 (etapa 4)?
5. Tamanho da primeira leva real e ritmo aceitável (ex.: 50 e depois o restante)?
6. Envio de teste: deixar só para os contatos digitados, ou também salvar uma lista fixa de "contatos de teste"?

## Situação (28/10/2026)
- Etapa 3 concluída: migração 0206 (botão fixo em msg_modelos; msg_campanhas, msg_campanha_destinatarios, msg_testes, só admin), passo Mensagem só WhatsApp (decisão do dono), envio de teste para telefone digitado via `disparo-campanha` (ação `teste`, 20/h por usuário). E-mail fora do fluxo avulso por ora.
- Etapa 4 (CONCLUÍDA): Revisar e enviar + `preparar` (snapshot, dedupe por telefone) + confirmação do total + Histórico; sem link de descadastro (e-mail fora do fluxo); envio real travado por msg_config.real_liberado=false.
- Etapa 5: liberar real_liberado por migração separada, com aprovação do dono, e enviar o primeiro lote de 50.

## Etapa 5 — concluída
Trava `real_liberado` liberada pela migração 0209 (rollback: scripts/msg-liberar-envio.rollback.sql). Coluna `reservado_em` e recuperação de presos (>10 min em enviando → falhou, nunca pendente) na 0208. O envio depende só do clique do dono; cada clique envia no máximo 50 (lote_limite), ordem alfabética.

## Cliente desde (out/2026)
Coluna manual `alunos.aluno_desde` (0210, vazia). Data efetiva = a MAIS ANTIGA entre o menor início de plano e a manual (se só existir uma, usa ela; nenhuma, null). Filtro de intervalo na lista exclui quem não tem data. Carga da planilha será feita depois, separadamente.
