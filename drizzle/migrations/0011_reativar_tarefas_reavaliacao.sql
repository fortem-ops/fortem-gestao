CREATE OR REPLACE FUNCTION public.fn_agendar_reavaliacoes_pendentes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aluno record;
  _last_data date;
  _criadas integer := 0;
BEGIN
  FOR _aluno IN
    SELECT id, responsavel_id FROM public.alunos WHERE status = 'ativo'
  LOOP
    SELECT MAX(d) INTO _last_data FROM (
      SELECT data AS d FROM public.avaliacoes
        WHERE aluno_id = _aluno.id AND lower(tipo) LIKE '%funcional%'
      UNION ALL
      SELECT data_especifica AS d FROM public.agenda_servicos
        WHERE aluno_id = _aluno.id
          AND atividade ILIKE '%funcional%'
          AND data_especifica IS NOT NULL
          AND data_especifica <= CURRENT_DATE
    ) x;

    IF _last_data IS NULL OR CURRENT_DATE >= _last_data + INTERVAL '4 months' THEN
      IF public.fn_criar_tarefa_reavaliacao(_aluno.id, _last_data, _aluno.responsavel_id) IS NOT NULL THEN
        _criadas := _criadas + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('tarefas_criadas', _criadas, 'executado_em', now());
END;
$function$;