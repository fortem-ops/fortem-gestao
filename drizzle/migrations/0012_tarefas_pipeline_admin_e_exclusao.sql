-- 1) Administrador responsável pelas tarefas comerciais (pipeline)
CREATE OR REPLACE FUNCTION public.fn_admin_tarefas_pipeline()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ORDER BY ur.created_at NULLS LAST, ur.user_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_tarefas_pipeline() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_tarefas_pipeline() TO service_role;

-- 2) fn_move_pipeline: tarefas de pipeline vão para o administrador
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
    IF _to_stage_name = 'Novo lead' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto, tipo_atividade)
      VALUES ('Realizar primeiro contato', 'Lead recém-criado no pipeline.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '1 day', 'alta', true, 'pipeline_novo_lead', 'ligacao');
    ELSIF _to_stage_name = 'Avaliação agendada' THEN
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

-- 3) Conclusão automática passa a excluir a tarefa
CREATE OR REPLACE FUNCTION public.fn_concluir_tarefas_por_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;

  IF lower(COALESCE(NEW.tipo,'')) LIKE '%funcional%' THEN
    DELETE FROM public.tarefas
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto = 'avaliacao_funcional_agendada';
  ELSIF lower(COALESCE(NEW.tipo,'')) LIKE '%experimental%' THEN
    DELETE FROM public.tarefas
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto = 'relatorio_experimental';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_tecnico_concluir_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_auto text;
BEGIN
  IF NEW.tipo <> 'relatorioforca' OR COALESCE(NEW.dados->>'status', '') <> 'finalizado' THEN
    RETURN NEW;
  END IF;

  v_tipo_auto := CASE NEW.protocolo_id
    WHEN '4b6b7a67-6b4b-424d-baf0-905d6548ffd7'::uuid THEN 'relatorio_tecnico_forca'
    WHEN '15007760-bc0c-4ff2-a48c-7d731f23b634'::uuid THEN 'relatorio_tecnico_corrida'
    ELSE NULL
  END;

  IF v_tipo_auto IS NULL THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.tarefas
   WHERE aluno_id = NEW.aluno_id
     AND tipo_auto = v_tipo_auto
     AND data_limite <= NEW.data;

  RETURN NEW;
END;
$function$;

-- 4) Responsável e coordenação podem excluir a própria tarefa ao concluir
DROP POLICY IF EXISTS "Responsible or coord/admin can delete tarefas" ON public.tarefas;
CREATE POLICY "Responsible or coord/admin can delete tarefas"
ON public.tarefas
FOR DELETE
TO authenticated
USING (auth.uid() = responsavel_id OR public.is_coordinator_or_admin(auth.uid()));