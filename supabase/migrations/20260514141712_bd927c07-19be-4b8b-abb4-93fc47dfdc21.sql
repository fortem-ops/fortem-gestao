
DROP FUNCTION IF EXISTS public.fn_ponto_dashboard_coordenador(date, date);

CREATE OR REPLACE FUNCTION public.fn_ponto_dashboard_periodo(
  p_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_fim    date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpis jsonb;
  v_ranking jsonb;
BEGIN
  IF NOT is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'em_jornada_agora',  (SELECT count(*) FROM ponto_jornadas WHERE data = CURRENT_DATE AND status = 'em_andamento' AND (intervalo_inicio IS NULL OR intervalo_fim IS NOT NULL)),
    'em_intervalo_agora',(SELECT count(*) FROM ponto_jornadas WHERE data = CURRENT_DATE AND status = 'em_andamento' AND intervalo_inicio IS NOT NULL AND intervalo_fim IS NULL),
    'fechadas_hoje',     (SELECT count(*) FROM ponto_jornadas WHERE data = CURRENT_DATE AND status = 'finalizada'),
    'divergencias_consideradas_periodo',
       COALESCE((SELECT sum(minutos_considerados) FROM ponto_jornadas WHERE data BETWEEN p_inicio AND p_fim), 0),
    'minutos_descontaveis_periodo',
       COALESCE((SELECT sum(minutos_descontaveis) FROM ponto_jornadas WHERE data BETWEEN p_inicio AND p_fim), 0),
    'minutos_extras_periodo',
       COALESCE((SELECT sum(minutos_extras_validos) FROM ponto_jornadas WHERE data BETWEEN p_inicio AND p_fim), 0),
    'jornadas_excedidas_periodo',
       (SELECT count(*) FROM ponto_jornadas WHERE data BETWEEN p_inicio AND p_fim AND tolerancia_excedida),
    'banco_liquido_periodo',
       COALESCE((SELECT sum(CASE WHEN tipo IN ('credito','hora_extra') THEN minutos
                                  WHEN tipo IN ('debito','tolerancia_excedida') THEN -minutos
                                  ELSE minutos END)
                  FROM ponto_banco_horas WHERE data BETWEEN p_inicio AND p_fim), 0)
  ) INTO v_kpis;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.minutos_considerados DESC), '[]'::jsonb)
  INTO v_ranking
  FROM (
    SELECT j.usuario_id,
           COALESCE(p.nome_completo, p.email, 'Sem nome') AS nome,
           SUM(j.minutos_considerados)::int AS minutos_considerados,
           SUM(j.minutos_descontaveis)::int AS minutos_descontaveis,
           SUM(j.minutos_extras_validos)::int AS minutos_extras,
           SUM(CASE WHEN j.tolerancia_excedida THEN 1 ELSE 0 END)::int AS dias_excedidos,
           COUNT(*)::int AS dias_trabalhados
    FROM ponto_jornadas j
    LEFT JOIN profiles p ON p.id = j.usuario_id
    WHERE j.data BETWEEN p_inicio AND p_fim
    GROUP BY j.usuario_id, p.nome_completo, p.email
    ORDER BY minutos_considerados DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'kpis', v_kpis,
    'ranking', v_ranking
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_ponto_dashboard_periodo(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ponto_dashboard_periodo(date, date) TO authenticated;
