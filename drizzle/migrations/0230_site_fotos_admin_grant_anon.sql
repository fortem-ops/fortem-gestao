-- A política de leitura do bucket site-fotos chama fn_site_fotos_admin(); sem EXECUTE o visitante recebe erro.
-- A função só retorna true para admin autenticado com perfil ativo; para anon retorna false.
GRANT EXECUTE ON FUNCTION public.fn_site_fotos_admin() TO anon;