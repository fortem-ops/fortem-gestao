CREATE OR REPLACE FUNCTION public.fn_clube_meu_plano()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _aluno uuid := public.fn_current_aluno_id();
BEGIN
  IF _aluno IS NULL THEN RETURN NULL; END IF;
  RETURN public.fn_clube_plano_info(_aluno)
    || jsonb_build_object(
      'semanas_seguidas', public.fn_clube_semanas_seguidas(_aluno),
      'multiplicadores', (SELECT coalesce(jsonb_object_agg(chave, valor::numeric), '{}'::jsonb)
                          FROM public.clube_config WHERE chave LIKE 'mult\_%'),
      'clima_multiplicador', (SELECT valor::numeric FROM public.clube_config WHERE chave = 'clima_multiplicador'));
END $function$;
REVOKE ALL ON FUNCTION public.fn_clube_meu_plano() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_clube_meu_plano() TO authenticated, service_role;
