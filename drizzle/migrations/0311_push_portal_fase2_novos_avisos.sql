CREATE OR REPLACE FUNCTION public.fn_portal_push_avisos_fase2(
  p_hoje date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS TABLE (
  aluno_id uuid,
  gatilho text,
  referencia text,
  url text,
  plano_tipo text,
  data_referencia date,
  valor numeric,
  saldo integer,
  anos integer,
  nome text,
  documentos integer,
  dias integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH checkins AS (
    SELECT t.aluno_id, (t.checkin_em AT TIME ZONE 'America/Sao_Paulo')::date AS data
    FROM public.treino_agendamentos t
    WHERE t.checkin_em IS NOT NULL

    UNION ALL

    SELECT t.aluno_id, t.data
    FROM public.treino_agendamentos t
    WHERE t.status = 'realizado'

    UNION ALL

    SELECT f.aluno_id, (f.evento_em AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.facial_eventos f
    WHERE f.aluno_id IS NOT NULL AND f.evento_em IS NOT NULL

    UNION ALL

    SELECT s.aluno_id, COALESCE((s.concluido_em AT TIME ZONE 'America/Sao_Paulo')::date, s.data)
    FROM public.treino_sessoes s
    WHERE s.concluido_em IS NOT NULL

    UNION ALL

    SELECT s.aluno_id, p.data
    FROM public.agenda_presencas p
    JOIN public.agenda_servicos s ON s.id = p.agenda_id
    WHERE p.comparecimento = true
      AND s.atividade ILIKE '%treino%'

    UNION ALL

    SELECT c.aluno_id, (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.contratos c
    WHERE c.plano_tipo IN ('gympass', 'wellhub', 'totalpass')
  ), ultimos_checkins AS (
    SELECT c.aluno_id, max(c.data) AS data
    FROM checkins c
    WHERE c.data <= p_hoje
    GROUP BY c.aluno_id
  ), congelados AS (
    SELECT l.aluno_id
    FROM public.aluno_licencas l
    WHERE p_hoje BETWEEN l.data_inicio AND l.data_fim

    UNION

    SELECT c.aluno_id
    FROM public.contratos c
    WHERE c.status = 'suspenso'
      AND c.data_inicio <= p_hoje
      AND (c.data_fim IS NULL OR c.data_fim >= p_hoje)
  ), documentos AS (
    SELECT d.aluno_id, count(*)::integer AS total
    FROM public.contratos_documentos d
    JOIN public.alunos a ON a.id = d.aluno_id
    WHERE d.aceite = false
      AND a.status = 'ativo'
      AND NOT COALESCE(a.is_equipe, false)
    GROUP BY d.aluno_id
  )
  SELECT
    a.id,
    'aniversario_aluno'::text,
    'aniversario_aluno:' || a.id::text || ':' || extract(year FROM p_hoje)::integer::text,
    '/portal'::text,
    NULL::text,
    a.data_nascimento,
    NULL::numeric,
    NULL::integer,
    NULL::integer,
    initcap(split_part(a.nome, ' ', 1)),
    NULL::integer,
    NULL::integer
  FROM public.alunos a
  WHERE a.status = 'ativo'
    AND NOT COALESCE(a.is_equipe, false)
    AND a.data_nascimento IS NOT NULL
    AND extract(month FROM a.data_nascimento) = extract(month FROM p_hoje)
    AND extract(day FROM a.data_nascimento) = extract(day FROM p_hoje)

  UNION ALL

  SELECT
    d.aluno_id,
    'documentos_pendentes'::text,
    'documentos:' || d.aluno_id::text || ':' || to_char(p_hoje, 'IYYY-"W"IW'),
    '/portal/contratos'::text,
    NULL::text,
    NULL::date,
    NULL::numeric,
    NULL::integer,
    NULL::integer,
    NULL::text,
    d.total,
    NULL::integer
  FROM documentos d

  UNION ALL

  SELECT
    a.id,
    'baixa_frequencia'::text,
    'ausencia:' || a.id::text || ':' || u.data::text || ':' || (p_hoje - u.data)::text,
    '/portal/agenda'::text,
    NULL::text,
    u.data,
    NULL::numeric,
    NULL::integer,
    NULL::integer,
    NULL::text,
    NULL::integer,
    p_hoje - u.data
  FROM public.alunos a
  JOIN ultimos_checkins u ON u.aluno_id = a.id
  WHERE a.status = 'ativo'
    AND NOT COALESCE(a.is_equipe, false)
    AND p_hoje - u.data IN (7, 10, 15, 20, 30)
    AND NOT EXISTS (SELECT 1 FROM congelados c WHERE c.aluno_id = a.id)

  ORDER BY 2, 3
$function$;

REVOKE ALL ON FUNCTION public.fn_portal_push_avisos_fase2(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_portal_push_avisos_fase2(date) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_clube_conceder_badge(p_aluno_id uuid, p_badge_nome text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _badge public.clube_badges%ROWTYPE;
  _rows int := 0;
BEGIN
  IF p_aluno_id IS NULL THEN RETURN false; END IF;

  SELECT * INTO _badge FROM public.clube_badges WHERE nome = p_badge_nome AND ativo = true LIMIT 1;
  IF _badge.id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.clube_aluno_badges (aluno_id, badge_id, conquistado_em)
  VALUES (p_aluno_id, _badge.id, now())
  ON CONFLICT (aluno_id, badge_id) DO NOTHING;

  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows > 0 AND current_setting('fortem.clube_backfill', true) IS DISTINCT FROM 'on' THEN
    PERFORM public.fn_call_edge_function('send-push-notification', jsonb_build_object(
      'aluno_id', p_aluno_id,
      'title', 'Nova conquista: ' || _badge.nome,
      'body', CASE WHEN COALESCE(_badge.pontos_bonus, 0) > 0
        THEN 'Você desbloqueou ' || _badge.nome || ' e ganhou ' || _badge.pontos_bonus || ' pontos no Clube FORTEM.'
        ELSE 'Você desbloqueou ' || _badge.nome || ' no Clube FORTEM.' END,
      'url', '/portal/clube',
      'gatilho', 'conquista',
      'referencia', 'conquista:' || _badge.id::text
    ));
  END IF;
  RETURN _rows > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_clube_conceder_badge(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clube_conceder_badge(uuid, text) TO service_role;