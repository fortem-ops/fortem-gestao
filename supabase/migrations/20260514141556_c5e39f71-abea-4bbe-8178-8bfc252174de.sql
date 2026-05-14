
-- 1. Add 'ponto' to notif_categoria enum
ALTER TYPE notif_categoria ADD VALUE IF NOT EXISTS 'ponto';

-- 2. Enable extensions for cron + http calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Dashboard aggregator function
CREATE OR REPLACE FUNCTION public.fn_ponto_dashboard_coordenador(
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
  v_ao_vivo jsonb;
BEGIN
  IF NOT is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- KPIs do período
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

  -- Ranking (top 10 por divergências consideradas)
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

  -- Ao vivo de hoje
  SELECT COALESCE(jsonb_agg(t ORDER BY t.nome), '[]'::jsonb)
  INTO v_ao_vivo
  FROM (
    SELECT j.usuario_id,
           COALESCE(p.nome_completo, p.email, 'Sem nome') AS nome,
           j.entrada, j.intervalo_inicio, j.intervalo_fim, j.saida,
           j.status, j.status_ponto, j.tolerancia_excedida,
           j.divergencia_total_dia, j.minutos_considerados
    FROM ponto_jornadas j
    LEFT JOIN profiles p ON p.id = j.usuario_id
    WHERE j.data = CURRENT_DATE
  ) t;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'kpis', v_kpis,
    'ranking', v_ranking,
    'ao_vivo', v_ao_vivo
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_ponto_dashboard_coordenador(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ponto_dashboard_coordenador(date, date) TO authenticated;

-- 4. Daily alerts function
CREATE OR REPLACE FUNCTION public.fn_ponto_alertas_diarios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jornada record;
  v_coord uuid;
  v_notif_id uuid;
  v_count int := 0;
  v_dest_count int := 0;
  v_titulo text;
  v_descricao text;
  v_prioridade notif_prioridade;
  v_severidade text;
  v_system_user uuid;
BEGIN
  -- Pick a system user (any admin) to attribute the notification
  SELECT user_id INTO v_system_user FROM user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_system_user IS NULL THEN
    SELECT user_id INTO v_system_user FROM user_roles WHERE role = 'coordenador' ORDER BY created_at LIMIT 1;
  END IF;
  IF v_system_user IS NULL THEN
    RETURN jsonb_build_object('error', 'sem admin/coordenador para criar notificacoes', 'criadas', 0);
  END IF;

  FOR v_jornada IN
    SELECT j.id, j.usuario_id, j.data, j.status_ponto, j.tolerancia_excedida,
           j.divergencia_total_dia, j.minutos_descontaveis,
           COALESCE(p.nome_completo, p.email, 'Colaborador') AS nome
    FROM ponto_jornadas j
    LEFT JOIN profiles p ON p.id = j.usuario_id
    WHERE j.data = CURRENT_DATE
      AND (
        j.tolerancia_excedida = true OR
        j.status_ponto IN ('banco_negativo', 'jornada_incompleta', 'falta_marcacao')
      )
  LOOP
    -- Severidade e prioridade
    IF v_jornada.status_ponto = 'falta_marcacao' THEN
      v_severidade := 'falta'; v_prioridade := 'urgente';
    ELSIF v_jornada.status_ponto = 'jornada_incompleta' THEN
      v_severidade := 'incompleta'; v_prioridade := 'alta';
    ELSIF v_jornada.status_ponto = 'banco_negativo' THEN
      v_severidade := 'banco_negativo'; v_prioridade := 'alta';
    ELSE
      v_severidade := 'tolerancia_excedida'; v_prioridade := 'media';
    END IF;

    v_titulo := format('Ponto: %s - %s', v_jornada.nome, v_severidade);
    v_descricao := format(
      'Jornada de %s apresentou %s. Divergência total: %s min. Minutos descontáveis: %s.',
      to_char(v_jornada.data, 'DD/MM/YYYY'),
      v_severidade,
      COALESCE(v_jornada.divergencia_total_dia, 0),
      COALESCE(v_jornada.minutos_descontaveis, 0)
    );

    -- Avoid duplicating an alert for the same jornada created today
    IF EXISTS (
      SELECT 1 FROM notificacoes
      WHERE categoria = 'ponto'
        AND aluno_id IS NULL
        AND created_at::date = CURRENT_DATE
        AND titulo = v_titulo
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO notificacoes (titulo, descricao, categoria, prioridade, tipo, criado_por, status)
    VALUES (v_titulo, v_descricao, 'ponto', v_prioridade, 'simples', v_system_user, 'nao_visualizada')
    RETURNING id INTO v_notif_id;

    -- Add destinatarios: o próprio colaborador + todos coord/admin
    INSERT INTO notificacao_destinatarios (notificacao_id, usuario_id)
    SELECT v_notif_id, ur.user_id
    FROM (
      SELECT user_id FROM user_roles WHERE role IN ('admin','coordenador')
      UNION
      SELECT v_jornada.usuario_id
    ) ur
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  -- Audit
  INSERT INTO audit_log (tabela, operacao, dados_depois, user_id)
  VALUES ('ponto_jornadas', 'cron_alertas_diarios',
          jsonb_build_object('alertas_criados', v_count, 'data', CURRENT_DATE),
          v_system_user);

  RETURN jsonb_build_object('criadas', v_count, 'data', CURRENT_DATE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_ponto_alertas_diarios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ponto_alertas_diarios() TO authenticated, service_role;
