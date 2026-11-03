# Corrigir salvamento em "Fotos do site"

## Problema
Ao salvar um ajuste, o servidor recusa com erro de permissão. A checagem de administrador (`fn_site_fotos_admin`) procura o perfil por `profiles.id = auth.uid()`, mas neste projeto o vínculo com o login é `profiles.user_id` (nos 2 admins, `id` difere de `user_id`). Resultado: nenhum admin passa, tanto para gravar enquadramento quanto para enviar foto nova.

## Correção
- Nova migração substituindo só o corpo de `fn_site_fotos_admin()`:
  `has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.ativo IS TRUE)`.
  Mesma assinatura, SECURITY DEFINER e permissões; políticas da tabela e do armazenamento continuam iguais (elas já usam essa função).
- Rollback em `scripts/` restaurando o corpo anterior.
- Nada muda na tela, no site público ou em outras tabelas.

## Verificação
- Ensaio revertido: como admin ativo, upsert em `site_fotos_ajuste` passa; como não-admin, continua bloqueado.
- Pedir que você salve de novo um ajuste na tela.
