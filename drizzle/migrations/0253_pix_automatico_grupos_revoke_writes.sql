-- Escrita nas tabelas de grupos só pelas funções (admin conferido no servidor); leitura via RLS.
REVOKE ALL ON public.pix_aut_grupos FROM anon;
REVOKE ALL ON public.pix_aut_itens FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pix_aut_grupos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pix_aut_itens FROM authenticated;
GRANT SELECT ON public.pix_aut_grupos TO authenticated;
GRANT SELECT ON public.pix_aut_itens TO authenticated;
