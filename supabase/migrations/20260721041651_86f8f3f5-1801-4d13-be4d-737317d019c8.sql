CREATE OR REPLACE FUNCTION public.fn_clube_dashboard(_periodo_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _total_alunos int;
  _total_membros int;
BEGIN
  -- Total de alunos ativos (base para taxa de ativação)
  SELECT count(*) INTO _total_alunos
  FROM public.alunos
  WHERE status = 'ativo';

  -- Membros ativos do clube vinculados a alunos ativos
  SELECT count(*) INTO _total_membros
  FROM public.clube_fortem_membros m
  JOIN public.alunos a ON a.id = m.aluno_id
  WHERE m.status_membro = 'ativo'
    AND a.status = 'ativo';

  WITH usos AS (
    SELECT
      u.*,
      b.titulo AS beneficio_titulo,
      p.nome AS parceiro_nome,
      p.categoria
    FROM public.uso_beneficios u
    JOIN public.beneficios b ON b.id = u.beneficio_id
    JOIN public.parceiros p ON p.id = u.parceiro_id
    WHERE u.created_at >= (now() - (_periodo_dias || ' days')::interval)
      AND u.status_validacao = 'valido'
  )
  SELECT jsonb_build_object(
    'usos_periodo', (SELECT count(*) FROM usos),
    'usos_hoje', (
      SELECT count(*)
      FROM public.uso_beneficios ub
      JOIN public.beneficios b ON b.id = ub.beneficio_id
      JOIN public.parceiros p ON p.id = ub.parceiro_id
      WHERE DATE(ub.created_at) = CURRENT_DATE
        AND ub.status_validacao = 'valido'
    ),
    'membros_ativos', _total_membros,
    'taxa_ativacao', CASE
      WHEN _total_alunos > 0 THEN round((_total_membros::numeric / _total_alunos) * 100, 1)
      ELSE 0
    END,
    'ranking_parceiros', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT parceiro_nome AS nome, count(*) AS usos
        FROM usos
        GROUP BY parceiro_nome
        ORDER BY usos DESC
        LIMIT 5
      ) r
    ), '[]'::jsonb),
    'beneficio_top', (
      SELECT beneficio_titulo
      FROM usos
      GROUP BY beneficio_titulo
      ORDER BY count(*) DESC
      LIMIT 1
    ),
    'uso_por_categoria', COALESCE((
      SELECT jsonb_agg(row_to_json(c))
      FROM (
        SELECT categoria, count(*) AS usos
        FROM usos
        GROUP BY categoria
        ORDER BY usos DESC
      ) c
    ), '[]'::jsonb),
    'parceiro_destaque', (
      SELECT parceiro_nome
      FROM usos
      GROUP BY parceiro_nome
      ORDER BY count(*) DESC
      LIMIT 1
    )
  ) INTO _result;

  RETURN _result;
END;
$function$;