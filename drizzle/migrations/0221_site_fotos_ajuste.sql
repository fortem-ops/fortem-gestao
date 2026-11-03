CREATE OR REPLACE FUNCTION public.fn_site_fotos_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo IS TRUE)
$$;
REVOKE ALL ON FUNCTION public.fn_site_fotos_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_site_fotos_admin() TO authenticated;

CREATE TABLE public.site_fotos_ajuste (
  chave text PRIMARY KEY,
  desk_x numeric NOT NULL DEFAULT 50 CHECK (desk_x BETWEEN 0 AND 100),
  desk_y numeric NOT NULL DEFAULT 50 CHECK (desk_y BETWEEN 0 AND 100),
  desk_zoom numeric NOT NULL DEFAULT 1 CHECK (desk_zoom BETWEEN 1 AND 2),
  mob_x numeric NOT NULL DEFAULT 50 CHECK (mob_x BETWEEN 0 AND 100),
  mob_y numeric NOT NULL DEFAULT 50 CHECK (mob_y BETWEEN 0 AND 100),
  mob_zoom numeric NOT NULL DEFAULT 1 CHECK (mob_zoom BETWEEN 1 AND 2),
  arquivo_path text,
  arquivo_width int,
  arquivo_height int,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_fotos_ajuste TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_fotos_ajuste TO authenticated;
GRANT ALL ON public.site_fotos_ajuste TO service_role;
ALTER TABLE public.site_fotos_ajuste ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_fotos leitura publica" ON public.site_fotos_ajuste FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site_fotos admin insert" ON public.site_fotos_ajuste FOR INSERT TO authenticated WITH CHECK (public.fn_site_fotos_admin());
CREATE POLICY "site_fotos admin update" ON public.site_fotos_ajuste FOR UPDATE TO authenticated USING (public.fn_site_fotos_admin()) WITH CHECK (public.fn_site_fotos_admin());
CREATE POLICY "site_fotos admin delete" ON public.site_fotos_ajuste FOR DELETE TO authenticated USING (public.fn_site_fotos_admin());

CREATE POLICY "site-fotos leitura publica" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-fotos');
CREATE POLICY "site-fotos admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-fotos' AND public.fn_site_fotos_admin());
CREATE POLICY "site-fotos admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-fotos' AND public.fn_site_fotos_admin());
CREATE POLICY "site-fotos admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-fotos' AND public.fn_site_fotos_admin());