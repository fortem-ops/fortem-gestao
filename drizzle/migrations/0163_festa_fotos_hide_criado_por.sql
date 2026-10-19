REVOKE SELECT ON public.festa_fotos FROM anon;
GRANT SELECT (id, ano, url, caminho, alt, ordem, created_at) ON public.festa_fotos TO anon;