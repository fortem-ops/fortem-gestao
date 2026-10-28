-- Rollback: volta o texto das reações/imagens antigas ao formato "[tipo]" e limpa as colunas novas.
UPDATE public.whatsapp_mensagens SET conteudo = '[' || tipo || ']', reacao_a_wamid = NULL, media_id = NULL, media_path = NULL, media_mime = NULL
WHERE tipo IN ('reaction','image','sticker');
-- As colunas (migração 0212) podem ficar; são opcionais e ignoradas pela tela antiga.
