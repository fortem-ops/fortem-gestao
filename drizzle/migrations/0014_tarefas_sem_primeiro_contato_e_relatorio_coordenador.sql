CREATE OR REPLACE FUNCTION public.fn_coordenador_tarefas()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'coordenador'
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.fn_coordenador_tarefas() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_move_pipeline(_aluno_id uuid, _to_stage_name text, _source pipeline_movement_source DEFAULT 'manual'::pipeline_movement_source, _notes text DEFAULT NULL::text, _moved_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _to_stage_id uuid;
  _from_stage_id uuid;
  _last_moved_at timestamptz;
  _time_in_prev interval;
  _movement_id uuid;
  _responsavel_tarefa uuid;
  _aluno_responsavel uuid;
  _meta_responsavel uuid;
BEGIN
  SELECT id INTO _to_stage_id
  FROM pipeline_stages WHERE name = _to_stage_name AND is_active = true;

  IF _to_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline stage % not found', _to_stage_name;
  END IF;

  SELECT current_pipeline_stage_id, responsavel_id
    INTO _from_stage_id, _aluno_responsavel
  FROM alunos WHERE id = _aluno_id;

  IF _from_stage_id IS NOT NULL AND _from_stage_id = _to_stage_id THEN
    RETURN NULL;
  END IF;

  IF _from_stage_id IS NOT NULL THEN
    SELECT moved_at INTO _last_moved_at
    FROM pipeline_movements
    WHERE aluno_id = _aluno_id AND to_stage_id = _from_stage_id
    ORDER BY moved_at DESC LIMIT 1;

    IF _last_moved_at IS NOT NULL THEN
      _time_in_prev := now() - _last_moved_at;
    END IF;
  END IF;

  INSERT INTO pipeline_movements (aluno_id, from_stage_id, to_stage_id, moved_by_user_id, time_in_previous_stage, notes, source)
  VALUES (_aluno_id, _from_stage_id, _to_stage_id, COALESCE(_moved_by, auth.uid()), _time_in_prev, _notes, _source)
  RETURNING id INTO _movement_id;

  UPDATE alunos SET current_pipeline_stage_id = _to_stage_id, updated_at = now()
  WHERE id = _aluno_id;

  SELECT responsavel_comercial_id INTO _meta_responsavel
  FROM pipeline_metadata WHERE aluno_id = _aluno_id;

  -- Tarefas comerciais são de responsabilidade do administrador
  _responsavel_tarefa := COALESCE(
    public.fn_admin_tarefas_pipeline(),
    _meta_responsavel,
    _aluno_responsavel,
    COALESCE(_moved_by, auth.uid())
  );

  IF _responsavel_tarefa IS NOT NULL THEN
    -- 'Novo lead' não gera mais tarefa de primeiro contato (pausado a pedido)
    IF _to_stage_name = 'Avaliação agendada' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto, tipo_atividade)
      VALUES ('Confirmar presença na avaliação', 'Confirmar com o aluno antes da data marcada.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '1 day', 'alta', true, 'pipeline_avaliacao_agendada', 'whatsapp');
    ELSIF _to_stage_name = 'Proposta enviada' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto, tipo_atividade)
      VALUES ('Follow-up da proposta', 'Retomar contato 3 dias após envio da proposta.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '3 days', 'media', true, 'pipeline_proposta', 'ligacao');
    END IF;
  END IF;

  RETURN _movement_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_gerar_tarefas_relatorio_tecnico(_data date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia int := EXTRACT(DAY FROM _data)::int;
  v_yasmim uuid;
  v_sistema uuid;
  v_coord uuid;
  v_criadas int := 0;
  v_n int;
BEGIN
  IF v_dia NOT IN (1, 15) THEN
    RETURN 0;
  END IF;

  SELECT user_id INTO v_yasmim FROM public.profiles
   WHERE full_name ILIKE 'Yasmim%' ORDER BY full_name LIMIT 1;

  SELECT user_id INTO v_sistema FROM public.user_roles WHERE role = 'admin' LIMIT 1;

  v_coord := public.fn_coordenador_tarefas();

  -- Força: apenas no dia 1, para todos os alunos ativos
  IF v_dia = 1 THEN
    INSERT INTO public.tarefas
      (titulo, descricao, aluno_id, responsavel_id, criado_por_id, prioridade, status,
       data_limite, automatica, tipo_auto, tipo_atividade, origem)
    SELECT
      'Relatório Técnico — Treinos de Força: ' || a.nome,
      'Preencha o Relatório Técnico (Treinos de força) do aluno referente ao ciclo de ' || to_char(_data, 'MM/YYYY') || '.',
      a.id,
      CASE
        WHEN v_coord IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = COALESCE(a.responsavel_id, v_sistema) AND ur.role = 'admin'
        ) THEN v_coord
        ELSE COALESCE(a.responsavel_id, v_sistema)
      END,
      v_sistema,
      'media',
      'pendente',
      _data,
      true,
      'relatorio_tecnico_forca',
      'tarefa',
      'tecnico'
    FROM public.alunos a
    WHERE a.status = 'ativo'
      AND COALESCE(a.responsavel_id, v_sistema) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tarefas t
        WHERE t.aluno_id = a.id
          AND t.tipo_auto = 'relatorio_tecnico_forca'
          AND t.data_limite = _data
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.avaliacoes av
        WHERE av.aluno_id = a.id
          AND av.tipo = 'relatorioforca'
          AND av.protocolo_id = '4b6b7a67-6b4b-424d-baf0-905d6548ffd7'::uuid
          AND av.data >= _data
          AND av.dados->>'status' = 'finalizado'
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_criadas := v_criadas + v_n;
  END IF;

  -- Corrida: dias 1 e 15, apenas alunos com plano de corrida ativo, responsável Yasmim
  INSERT INTO public.tarefas
    (titulo, descricao, aluno_id, responsavel_id, criado_por_id, prioridade, status,
     data_limite, automatica, tipo_auto, tipo_atividade, origem)
  SELECT DISTINCT ON (a.id)
    'Relatório Técnico — Treinos de Corrida: ' || a.nome,
    'Preencha o Relatório Técnico (Treinos de corrida) do aluno referente ao ciclo de ' || to_char(_data, 'DD/MM/YYYY') || '.',
    a.id,
    CASE
      WHEN v_coord IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = COALESCE(v_yasmim, a.responsavel_id, v_sistema) AND ur.role = 'admin'
      ) THEN v_coord
      ELSE COALESCE(v_yasmim, a.responsavel_id, v_sistema)
    END,
    v_sistema,
    'media',
    'pendente',
    _data,
    true,
    'relatorio_tecnico_corrida',
    'tarefa',
    'tecnico'
  FROM public.alunos a
  JOIN public.planos p ON p.aluno_id = a.id AND p.ativo AND p.atividade = 'corrida'
  WHERE a.status = 'ativo'
    AND COALESCE(v_yasmim, a.responsavel_id, v_sistema) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.aluno_id = a.id
        AND t.tipo_auto = 'relatorio_tecnico_corrida'
        AND t.data_limite = _data
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.avaliacoes av
      WHERE av.aluno_id = a.id
        AND av.tipo = 'relatorioforca'
        AND av.protocolo_id = '15007760-bc0c-4ff2-a48c-7d731f23b634'::uuid
        AND av.data >= _data
        AND av.dados->>'status' = 'finalizado'
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_criadas := v_criadas + v_n;

  RETURN v_criadas;
END;
$$;