-- Rollback de 0221_site_fotos_ajuste (apaga ajustes salvos; arquivos do bucket site-fotos devem ser removidos pela Storage API)
DROP POLICY IF EXISTS "site-fotos leitura publica" ON storage.objects;
DROP POLICY IF EXISTS "site-fotos admin insert" ON storage.objects;
DROP POLICY IF EXISTS "site-fotos admin update" ON storage.objects;
DROP POLICY IF EXISTS "site-fotos admin delete" ON storage.objects;
DROP TABLE IF EXISTS public.site_fotos_ajuste;
DROP FUNCTION IF EXISTS public.fn_site_fotos_admin();
