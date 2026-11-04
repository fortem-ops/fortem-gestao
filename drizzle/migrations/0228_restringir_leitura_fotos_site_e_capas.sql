-- site_fotos_ajuste: leitura pública só via função; tabela só para admin
DROP POLICY IF EXISTS "site_fotos leitura publica" ON public.site_fotos_ajuste;
CREATE POLICY "site_fotos admin select" ON public.site_fotos_ajuste
  FOR SELECT TO authenticated USING (public.fn_site_fotos_admin());

CREATE OR REPLACE FUNCTION public.fn_site_fotos_publico()
RETURNS TABLE (chave text, desk_x numeric, desk_y numeric, desk_zoom numeric,
  mob_x numeric, mob_y numeric, mob_zoom numeric, arquivo_path text,
  arquivo_width integer, arquivo_height integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT chave::text, desk_x::numeric, desk_y::numeric, desk_zoom::numeric,
         mob_x::numeric, mob_y::numeric, mob_zoom::numeric, arquivo_path::text,
         arquivo_width::integer, arquivo_height::integer
  FROM public.site_fotos_ajuste;
$$;
REVOKE ALL ON FUNCTION public.fn_site_fotos_publico() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_site_fotos_publico() TO anon, authenticated, service_role;

-- só o arquivo atualmente publicado de cada foto é legível
CREATE OR REPLACE FUNCTION public.fn_site_foto_publicada(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.site_fotos_ajuste WHERE arquivo_path = p_nome);
$$;
REVOKE ALL ON FUNCTION public.fn_site_foto_publicada(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_site_foto_publicada(text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "site-fotos leitura publica" ON storage.objects;
CREATE POLICY "site-fotos leitura publicada" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-fotos' AND (public.fn_site_foto_publicada(name) OR public.fn_site_fotos_admin()));

-- capas da comunidade: dono, equipe, ou capa de clube visível ao usuário
DROP POLICY IF EXISTS comunidade_capas_select ON storage.objects;
CREATE POLICY comunidade_capas_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comunidade-clubes' AND (
    public.is_staff()
    OR (storage.foldername(name))[1] = (public.fn_comunidade_meu_aluno())::text
    OR EXISTS (SELECT 1 FROM public.comunidade_clubes c WHERE c.capa_url = storage.objects.name)
  ));