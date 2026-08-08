DO $do$
DECLARE
  _src text := pg_get_functiondef('public.fn_processar_horarios_fixos()'::regprocedure);
  _new text;
BEGIN
  _new := regexp_replace(
    _src,
    'SELECT data_fim INTO _plano_fim\s+FROM planos\s+WHERE aluno_id = _hf\.aluno_id AND ativo = true\s+ORDER BY created_at DESC LIMIT 1;',
    'SELECT (public.fn_plano_principal_ativo(_hf.aluno_id)).data_fim INTO _plano_fim;',
    'g');
  IF _new = _src THEN
    RAISE EXCEPTION 'Padrão não encontrado em fn_processar_horarios_fixos';
  END IF;
  EXECUTE _new;
END
$do$;