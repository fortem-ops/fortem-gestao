-- Rollback das fotos da festa (aba "Fotos da história")
DROP POLICY IF EXISTS festa_fotos_storage_select ON storage.objects;
DROP POLICY IF EXISTS festa_fotos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS festa_fotos_storage_delete ON storage.objects;
DROP TABLE IF EXISTS public.festa_fotos;
-- bucket festa-fotos: remover pela ferramenta de storage
