CREATE OR REPLACE FUNCTION public.fn_historico_horario_treino(
  p_slot_id uuid,
  p_data date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean := false;
  v_fila jsonb;
  v_eventos jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role IN ('admin', 'coordenador', 'professor', 'nutricionista', 'fisioterapeuta')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Acesso restrito à equipe' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'aluno_id', f.aluno_id,
        'aluno_nome', COALESCE(a.nome, 'Aluno'),
        'created_at', f.created_at
      )
      ORDER BY f.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_fila
  FROM public.portal_fila_espera f
  LEFT JOIN public.alunos a ON a.id = f.aluno_id
  WHERE f.tipo = 'treino'
    AND f.slot_id = p_slot_id
    AND f.data = p_data
    AND f.status = 'ativo';

  WITH base_ag AS (
    SELECT
      ta.id,
      ta.aluno_id,
      COALESCE(a.nome, 'Aluno') AS aluno_nome,
      a.user_id AS aluno_user_id,
      ta.status,
      ta.created_at,
      ta.created_by,
      ta.updated_at,
      ta.cancelado_em,
      ta.cancelado_por,
      ta.credito_estornado,
      ta.checkin_em,
      ta.checkin_origem,
      p_criador.full_name AS criador_profile_nome,
      al_ins.user_id AS audit_ins_user_id,
      p_ins.full_name AS audit_ins_nome,
      al_can.user_id AS audit_can_user_id,
      p_can.full_name AS audit_can_nome
    FROM public.treino_agendamentos ta
    LEFT JOIN public.alunos a ON a.id = ta.aluno_id
    LEFT JOIN public.profiles p_criador ON p_criador.user_id = ta.created_by
    LEFT JOIN LATERAL (
      SELECT al.user_id
      FROM public.audit_log al
      WHERE al.tabela = 'treino_agendamentos'
        AND al.registro_id = ta.id::text
        AND al.operacao = 'insert'
      ORDER BY al.created_at DESC
      LIMIT 1
    ) al_ins ON true
    LEFT JOIN public.profiles p_ins ON p_ins.user_id = al_ins.user_id
    LEFT JOIN LATERAL (
      SELECT al.user_id
      FROM public.audit_log al
      WHERE al.tabela = 'treino_agendamentos'
        AND al.registro_id = ta.id::text
        AND al.operacao IN ('update', 'delete')
      ORDER BY al.created_at DESC
      LIMIT 1
    ) al_can ON true
    LEFT JOIN public.profiles p_can ON p_can.user_id = al_can.user_id
    WHERE ta.slot_id = p_slot_id
      AND ta.data = p_data
  ),
  ev_agendou AS (
    SELECT
      'ag:' || b.id::text AS id,
      b.created_at AS ocorrido_em,
      'agendou'::text AS tipo,
      b.aluno_id,
      b.aluno_nome,
      CASE
        WHEN b.audit_ins_nome IS NOT NULL THEN b.audit_ins_nome
        WHEN b.created_by IS NOT NULL AND b.aluno_user_id IS NOT NULL AND b.created_by = b.aluno_user_id THEN b.aluno_nome
        WHEN b.criador_profile_nome IS NOT NULL THEN b.criador_profile_nome
        ELSE NULL
      END AS autor_nome,
      CASE
        WHEN b.audit_ins_user_id IS NOT NULL THEN 'equipe'
        WHEN b.created_by IS NOT NULL AND b.aluno_user_id IS NOT NULL AND b.created_by = b.aluno_user_id THEN 'aluno'
        WHEN b.criador_profile_nome IS NOT NULL THEN 'equipe'
        ELSE NULL
      END AS autor_tipo,
      NULL::text AS detalhe
    FROM base_ag b
  ),
  ev_cancelou AS (
    SELECT
      'can:' || b.id::text AS id,
      COALESCE(b.cancelado_em, b.updated_at) AS ocorrido_em,
      'cancelou'::text AS tipo,
      b.aluno_id,
      b.aluno_nome,
      CASE
        WHEN b.cancelado_por = 'aluno' THEN b.aluno_nome
        WHEN b.audit_can_nome IS NOT NULL THEN b.audit_can_nome
        WHEN b.cancelado_por IS NOT NULL AND b.cancelado_por NOT IN ('aluno', 'staff', 'equipe', 'sistema') THEN b.cancelado_por
        ELSE NULL
      END AS autor_nome,
      CASE
        WHEN b.cancelado_por = 'aluno' THEN 'aluno'
        WHEN b.audit_can_user_id IS NOT NULL OR b.cancelado_por IN ('staff', 'equipe') THEN 'equipe'
        WHEN b.cancelado_por = 'sistema' THEN 'sistema'
        ELSE NULL
      END AS autor_tipo,
      CASE
        WHEN b.credito_estornado IS TRUE THEN 'Crédito devolvido'
        WHEN b.credito_estornado IS FALSE THEN 'Sem devolução de crédito'
        ELSE NULL
      END AS detalhe
    FROM base_ag b
    WHERE b.status = 'cancelado' OR b.cancelado_em IS NOT NULL
  ),
  ev_checkin AS (
    SELECT
      'chk:' || b.id::text AS id,
      b.checkin_em AS ocorrido_em,
      'checkin'::text AS tipo,
      b.aluno_id,
      b.aluno_nome,
      b.aluno_nome AS autor_nome,
      'aluno'::text AS autor_tipo,
      NULLIF(b.checkin_origem, '') AS detalhe
    FROM base_ag b
    WHERE b.checkin_em IS NOT NULL
  ),
  ev_presenca AS (
    SELECT
      'st:' || b.id::text AS id,
      b.updated_at AS ocorrido_em,
      CASE WHEN b.status = 'realizado' THEN 'presenca' ELSE 'falta' END AS tipo,
      b.aluno_id,
      b.aluno_nome,
      NULL::text AS autor_nome,
      NULL::text AS autor_tipo,
      NULL::text AS detalhe
    FROM base_ag b
    WHERE b.status IN ('realizado', 'faltou')
      AND b.checkin_em IS NULL
  ),
  ev_fila_entrou AS (
    SELECT
      'fe:' || f.id::text AS id,
      f.created_at AS ocorrido_em,
      'fila_entrou'::text AS tipo,
      f.aluno_id,
      COALESCE(a.nome, 'Aluno') AS aluno_nome,
      COALESCE(a.nome, 'Aluno') AS autor_nome,
      'aluno'::text AS autor_tipo,
      NULL::text AS detalhe
    FROM public.portal_fila_espera f
    LEFT JOIN public.alunos a ON a.id = f.aluno_id
    WHERE f.tipo = 'treino'
      AND f.slot_id = p_slot_id
      AND f.data = p_data
  ),
  ev_fila_fim AS (
    SELECT
      'ff:' || f.id::text AS id,
      f.updated_at AS ocorrido_em,
      CASE
        WHEN f.status = 'notificado' THEN 'fila_avisado'
        ELSE 'fila_saiu'
      END AS tipo,
      f.aluno_id,
      COALESCE(a.nome, 'Aluno') AS aluno_nome,
      CASE
        WHEN f.status = 'notificado' THEN 'Sistema'
        ELSE COALESCE(a.nome, 'Aluno')
      END AS autor_nome,
      CASE
        WHEN f.status = 'notificado' THEN 'sistema'
        ELSE 'aluno'
      END AS autor_tipo,
      CASE
        WHEN f.status = 'atendido' THEN 'Agendou a vaga'
        WHEN f.status = 'expirado' THEN 'Horário encerrado'
        ELSE NULL
      END AS detalhe
    FROM public.portal_fila_espera f
    LEFT JOIN public.alunos a ON a.id = f.aluno_id
    WHERE f.tipo = 'treino'
      AND f.slot_id = p_slot_id
      AND f.data = p_data
      AND f.status <> 'ativo'
  ),
  todos AS (
    SELECT * FROM ev_agendou
    UNION ALL SELECT * FROM ev_cancelou
    UNION ALL SELECT * FROM ev_checkin
    UNION ALL SELECT * FROM ev_presenca
    UNION ALL SELECT * FROM ev_fila_entrou
    UNION ALL SELECT * FROM ev_fila_fim
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'ocorrido_em', t.ocorrido_em,
        'tipo', t.tipo,
        'aluno_id', t.aluno_id,
        'aluno_nome', t.aluno_nome,
        'autor_nome', t.autor_nome,
        'autor_tipo', t.autor_tipo,
        'detalhe', t.detalhe
      )
      ORDER BY t.ocorrido_em DESC
    ),
    '[]'::jsonb
  )
  INTO v_eventos
  FROM todos t;

  RETURN jsonb_build_object(
    'fila_ativa', v_fila,
    'eventos', v_eventos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_historico_horario_treino(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_historico_horario_treino(uuid, date) TO authenticated, service_role;