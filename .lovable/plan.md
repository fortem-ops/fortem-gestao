# Push para a equipe — plano por fases

Push é um canal a mais. Tudo continua aparecendo dentro do sistema como hoje. Só os gatilhos da lista geram push; os marcados "SEM push" nunca geram. Cada fase só começa após sua aprovação; nenhuma migração é aplicada antes.

## O que já existe (lido no código)
- `portal_push_subscriptions` (por `aluno_id`) e a função `send-push-notification`, que envia para um aluno com `web-push` e chaves VAPID (com conversão da chave PKCS8).
- `public/sw.js` já trata `push` e `notificationclick` (sem URL abre `/portal`).
- Já existem rotinas que serão a fonte dos gatilhos: `planos-recorrencia-diario`, `notificar-compra-recusada`, `auditoria-fiscal-pagamentos`, `verificar-pagamentos-pix-diario`, `ponto-alertas-diarios`, `ponto-notificar-pendencias`, `notify-notificacao-evento`, `check-push-triggers`.
- A primeira etapa de cada fase confere no banco os detalhes ainda não lidos (campo de "funcionário ativo", estrutura de tarefas, `v_tecnico_alertas`, fila do Fiscal) antes de escrever SQL.

## Fase 1 — Infraestrutura

**Tabelas (uma migração)**
- `equipe_push_subscriptions`: `id`, `user_id` (uuid, sem FK para auth), `endpoint` único, `p256dh`, `auth`, `user_agent`, `created_at`, `last_used_at`.
  RLS: o próprio usuário (staff) faz select/insert/update/delete só nas suas linhas; admin (`is_admin`) lê todas. Grants para `authenticated` e `service_role`, nada para `anon`.
- `equipe_push_log`: `user_id`, `gatilho`, `titulo`, `corpo`, `referencia` (texto, ex. `venda:123:D+1`), `sucesso`, `erro`, `enviado_em`.
  Índice único parcial em `(gatilho, referencia, user_id)` onde `sucesso` ou "reservado" → deduplicação. A função reserva a linha antes de enviar (insert ... on conflict do nothing); se já existe, não envia.
  RLS: só admin lê; só `service_role` escreve.

**Função `send-push-equipe`** (edge, só chamada pelo servidor: exige chave de serviço/cron, recusa chamada de usuário comum)
- Entrada validada (Zod): `user_ids[]` ou `papel`, `gatilho`, `referencia`, `titulo`, `corpo`, `url`, `urgente` (bool).
- Regras aplicadas sempre, num módulo compartilhado `_shared/push-equipe.ts`:
  - `gatilho` precisa estar na lista fixa de gatilhos permitidos (os "SEM push" não existem na lista → recusados).
  - Funcionário inativo/desligado e sem papel de equipe é descartado.
  - Não urgente fora do expediente (seg–qui 06:10–20:40, sex 06:10–19:40, Brasília) não sai; cobrança e falha de rotina saem a qualquer hora.
  - Texto com "comissionamento" (qualquer caixa/acento) ou "!" é recusado.
  - Deduplicação pelo log.
  - 404/410 apaga a inscrição; sucesso atualiza `last_used_at`.
- Lógica VAPID movida para `_shared/vapid.ts` e usada pelas duas funções (a do aluno não muda de comportamento).

**Telas**
- Botão "Ativar notificações" no menu do usuário da equipe (tema escuro), com estado deste aparelho: Ativadas / Desativadas / Bloqueadas no navegador. Desativar apaga só a inscrição deste aparelho. No iPhone, aviso de que só funciona pelo atalho "FORTEM Equipe".
- Hook `useEquipePush` separado do `usePushNotifications` do aluno.
- `sw.js`: `notificationclick` abre a `url` do payload (tarefa, aluno, cobrança, comunicado). Push da equipe sem URL abre `/` (nunca `/portal`).
- Admin: aba simples "Push da equipe" com o log (quem, gatilho, sucesso/erro) e um botão "Enviar teste para mim".

**Testes Fase 1**: regras do `_shared/push-equipe.ts` (gatilho fora da lista, inativo, expediente, "comissionamento", "!", dedup), apagar 404/410, envio por pessoa e por papel, hook de inscrever/cancelar.

## Antes das Fases 2–4: textos para sua revisão
Entrego uma tabela com todos os gatilhos: título, corpo, para quem, horário, link de destino. Sem exclamação, sem "comissionamento". Só implemento os gatilhos depois da aprovação dos textos.

## Fase 2 — Cobrança (admin), urgentes
| Gatilho | Onde nasce |
|---|---|
| Cartão recusado D0 (motivo da Rede), D+1, D+3 (inadimplente) | `planos-recorrencia-diario` / `notificar-compra-recusada` |
| Cartão salvo vencendo no mês seguinte | cron diário 07:30, 1 vez por cartão/mês |
| Pix Automático não pago no vencimento; autorização cancelada | `verificar-pagamentos-pix-diario` e webhook do Inter |
| Mensalidade com baixa manual vencendo hoje | cron 07:30 |
| Mensalidade vencida sem baixa: só D+5 e D+10 | cron 07:30 |
| Link de pagamento/contrato não pago em 48h → quem enviou | cron horário (`links_pagamento`, `links_contrato`) |
| Cobrança das 08:00 não rodou, falhou ou bateu R$ 30.000 | verificação às 08:30 + fim da rotina |
| Inconsistência crítica do Fiscal de Pagamentos | `auditoria-fiscal-pagamentos` |
SEM push: chargeback e pagamento de inadimplente.

## Fase 3 — Equipe, professor, coordenador
- Equipe: comunicado do Notificar (destinatários, via `notify-notificacao-evento`), tarefa atrasada (responsável), divergência de ponto acima da tolerância e fechamento mensal disponível (`ponto-alertas-diarios`).
- Professor: experimental agendada com ele; mensagem/feedback do portal; aluno novo atribuído; aniversariantes (07:30); sem treinar 7/15/30 dias (07:30, só nesses dias); tarefas técnicas no vencimento; lembrete de ponto 15 min após horário sem marcação (só professor, checado no envio).
- Coordenador: tarefas atrasadas por profissional (resumo 07:30), alunos sem professor, `v_tecnico_alertas`, ponto da equipe, pedido de cancelamento, Fiscal de Avaliações (gatilho criado, liga quando o Fiscal existir).
- Os itens "SEM push" da sua lista ficam de fora.

## Fase 4 — Admin comercial/operação, nutri, fisio
- Admin: lead 5 dias úteis sem retorno; experimental não convertida em 48h; venda do /planos; contrato vencendo só em 15 e 7 dias; aceite pendente acima de 30 dias; facial offline (`facial_agente_status`); críticos dos Fiscais de Créditos, Agenda de Serviços, Pipeline e Contratos; falha de rotina (crons, webhook Rede, Inter, disparos) — urgente.
- Nutri: consulta agendada/remarcada/cancelada; consultas do dia 07:30; retorno vencendo; anamnese/questionário preenchido.
- Fisio: consulta/sessão agendada/remarcada/cancelada; atendimentos do dia 07:30; relatório de reabilitação no vencimento.

## Como os gatilhos disparam
- Eventos imediatos: chamada a `send-push-equipe` no ponto onde o evento já é tratado (função existente ou trigger leve que enfileira).
- Lembretes do dia: uma função nova `push-equipe-diario` (07:30 Brasília) que roda os gatilhos de horário; e `push-equipe-horario` (a cada 15 min) para links 48h, ponto 15 min e verificação da cobrança das 08:00. Agendamento pelo mecanismo gerenciado do projeto.
- Cada gatilho tem uma função pura de "quem recebe e qual referência", testada isoladamente.

## Testes (por fase, rodando `bunx vitest run` + eslint, sem `any`)
- Inscrever/cancelar por funcionário; envio por pessoa e por papel; 404/410 apaga.
- Dedup: mesmo gatilho+referência+pessoa só uma vez.
- Cada gatilho da lista vai para o papel certo; cada "SEM push" é recusado.
- Mensalidade vencida só em D+5 e D+10; contrato só em 15 e 7 dias.
- Lembrete de ponto só professor; inativo não recebe; expediente respeitado para não urgentes.

## Detalhes técnicos
- Novos: migração Fase 1, `supabase/functions/send-push-equipe/`, `_shared/vapid.ts`, `_shared/push-equipe.ts` (+ testes Deno), `src/hooks/useEquipePush.ts`, `src/components/equipe/AtivarNotificacoes.tsx`, página/aba do log, testes vitest; nas fases 2–4, `push-equipe-diario`, `push-equipe-horario` e chamadas nas funções citadas.
- Alterados: `send-push-notification` (passa a importar `_shared/vapid.ts`), `public/sw.js`, menu da equipe, `AGENTS.md` de `supabase/functions` (regra do push da equipe).
- Sem novo segredo: usa as chaves VAPID já configuradas.
