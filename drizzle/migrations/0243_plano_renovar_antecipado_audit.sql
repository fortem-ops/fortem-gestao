DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.fn_plano_renovar_antecipado(uuid)'::regprocedure) INTO src;
  src := replace(src, 'INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, dados_novos)
  SELECT auth.uid(), ''renovacao_antecipada'', ''planos'', p.id,', 'INSERT INTO public.audit_log (user_id, operacao, tabela, registro_id, dados_depois)
  SELECT auth.uid(), ''RENOVACAO_ANTECIPADA'', ''planos'', p.id,');
  src := replace(src, '
  WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=''public'' AND table_name=''audit_log'' AND column_name=''acao'');', ';');
  EXECUTE src;
END $do$;