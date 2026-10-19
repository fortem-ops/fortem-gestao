DROP POLICY IF EXISTS festa_fotos_publico_select ON public.festa_fotos;
REVOKE SELECT ON public.festa_fotos FROM anon;
CREATE POLICY festa_fotos_gestao_select ON public.festa_fotos FOR SELECT TO authenticated USING (public.fn_festa_gestao(auth.uid()));
DROP POLICY IF EXISTS festa_fotos_storage_select ON storage.objects;
CREATE POLICY festa_fotos_storage_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'festa-fotos' AND public.fn_festa_gestao(auth.uid()));