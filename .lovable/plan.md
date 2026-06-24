## 1. Parar de gerar notificações de ponto

Nova migração SQL:

- Recriar `fn_ponto_registrar` e `fn_ponto_alertas_diarios` removendo todos os `INSERT INTO notificacoes` / `notificacao_destinatarios` de categoria `ponto`. A lógica de ponto (registro de eventos, alertas internos do painel) continua funcionando — apenas deixa de criar registro em "Notificar".
- Apagar histórico já existente: `DELETE FROM notificacoes WHERE categoria = 'ponto'` (cascade remove destinatários, comentários e histórico). São 11 registros atuais.
- `AlertasPontoPanel` lê `notificacoes` filtrando por `categoria='ponto'` — vai ficar vazio, que é o comportamento desejado.

## 2. Arquivar conversa por usuário

Hoje só o criador consegue mudar o `status` da notificação, e a aba "Arquivadas" filtra pelo status global. Vamos passar a usar `notificacao_destinatarios.status = 'arquivada'` **por usuário**, mantendo o status global apenas como atalho do criador.

**`src/components/notificar/NotificacaoDetail.tsx`**
- Adicionar botão "Arquivar" / "Desarquivar" no cabeçalho, visível para qualquer participante (criador ou destinatário).
- Criador: atualiza `notificacoes.status` para `arquivada` / volta para `aberta`.
- Destinatário: faz `update` em `notificacao_destinatarios` (escopo `usuario_id = auth.uid()` + `notificacao_id`), alternando entre `arquivada` e `lida`.
- Invalida queries `["notif"]`.

**`src/pages/Notificar.tsx`**
- Ajustar o filtro da aba "Arquivadas":
  - Em `recebidas`: arquivada quando `dest_status === 'arquivada'` ou a notificação global estiver `arquivada/concluida`.
  - Em `enviadas`: arquivada quando `status === 'arquivada' | 'concluida'`.

**`src/hooks/useNotificacoes.ts`**
- `useUnreadCount`: ignorar destinatários com `status='arquivada'` (não contar como não-lida).
- Demais hooks já retornam `dest_status`, sem mudança.

## Detalhes técnicos

- O RLS de `notificacao_destinatarios` já permite o próprio usuário fazer `UPDATE` (`usuario_id = auth.uid()`), então não precisa de policy nova.
- Não disparar entrada em `notificacao_historico` para o arquivamento individual (evita poluir o log de todos).
- Após implementar: rodar `npx tsc --noEmit`.

## Arquivos afetados

- Migração nova: remoção das notificações de ponto + DELETE dos registros existentes
- `src/components/notificar/NotificacaoDetail.tsx`
- `src/pages/Notificar.tsx`
- `src/hooks/useNotificacoes.ts`
