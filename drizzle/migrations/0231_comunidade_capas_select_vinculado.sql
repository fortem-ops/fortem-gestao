DROP POLICY IF EXISTS comunidade_capas_select ON storage.objects;
CREATE POLICY comunidade_capas_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comunidade-clubes' AND (
    public.is_staff()
    OR (storage.foldername(name))[1] = (public.fn_comunidade_meu_aluno())::text
    OR (public.fn_comunidade_meu_aluno() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.comunidade_clubes c
      WHERE c.capa_url = storage.objects.name
        AND (c.status = 'ativo' OR c.criador_aluno_id = public.fn_comunidade_meu_aluno())
    ))
  ));