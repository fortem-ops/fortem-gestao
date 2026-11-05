# Corrigir erro ao enviar imagem em resposta no Notificar

## Causa (confirmada)
Você tentou colar uma imagem na resposta da notificação "Erro ao adicionar exercícios no banco de dados", que o Gustavo criou e enviou a você. Hoje, só quem criou a notificação pode enviar anexos para ela. Quem a recebeu, mesmo sendo destinatário, é bloqueado e vê "new row violates row-level security policy". A leitura dos anexos já permite autor e destinatários, mas o envio não.

## Correção
- Quem recebeu a notificação também pode enviar imagens e arquivos nas respostas.
- Continua bloqueado para quem não é autor nem destinatário. O formato das pastas segue validado (uma pasta por notificação).
- Nada muda nas telas nem nos anexos que já existem.

## Detalhes técnicos
- Nova migração: remover e recriar a policy de INSERT "Authenticated upload notif anexos" em `storage.objects` (bucket `notificacao-anexos`). A condição passa a ser `n.criado_por = auth.uid()` OU existir uma linha em `notificacao_destinatarios` com `notificacao_id` = pasta e `usuario_id = auth.uid()`. As mesmas checagens de pasta UUID continuam.
- Rollback: recriar a policy anterior (registrada em comentário na migração).
- Verificação: conferir a policy em `pg_policies` e ensaiar o envio como destinatário, se houver sessão disponível.
